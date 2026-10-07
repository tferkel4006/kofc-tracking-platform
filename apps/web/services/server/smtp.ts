// A small SMTP submission client for councils' own email gateways (Sprint 6Z-Email-Proxy). SERVER ONLY.
//
// No mail library is installed, so this speaks just enough SMTP (RFC 5321) for one plain-text message, with any
// attachments, to one recipient: EHLO, STARTTLS (or TLS from the start on port 465), AUTH PLAIN or LOGIN, MAIL, RCPT,
// DATA, QUIT. It never signs in over a connection that is not encrypted: a server that offers no STARTTLS is refused
// before the password is sent. Errors quote the server's replies, never the credentials.
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import type { EmailPayload } from '@kofc/shared';

if (typeof window !== 'undefined') {
  throw new Error('services/server/smtp.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

export interface SmtpConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface SmtpMessage {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachments: EmailPayload['attachments'];
}

export interface SmtpOptions {
  /** Per-reply timeout; the default is 20 seconds. */
  timeoutMs?: number;
  /** Extra TLS options (tests); certificates are always verified unless a caller turns that off here. */
  tls?: tls.ConnectionOptions;
}

/** An address safe to put inside <...> on an SMTP command line and in a header. */
const ADDRESS = /^[^\s@<>"(),;:\\]+@[^\s@<>"(),;:\\]+\.[^\s@<>"(),;:\\]+$/;
const EMAILISH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SmtpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmtpError';
  }
}

/**
 * The message as the council's gateway sends it. Hosted providers (Google Workspace, Microsoft 365) refuse a From that
 * is not the signed-in mailbox, so when the SMTP username is an address the mail goes out From it, and the portal's
 * own sender becomes the Reply-To.
 */
export function smtpMessageFor(email: EmailPayload, smtpUsername: string): SmtpMessage {
  const mailbox = smtpUsername.trim();
  if (EMAILISH.test(mailbox) && mailbox.toLowerCase() !== email.from.toLowerCase()) {
    return { from: mailbox, replyTo: email.from, to: email.to, subject: email.subject, text: email.text, attachments: email.attachments };
  }
  return { from: email.from, to: email.to, subject: email.subject, text: email.text, attachments: email.attachments };
}

const oneLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();
const wrap76 = (b64: string): string => b64.replace(/.{1,76}/g, '$&\r\n');
const base64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');
/** RFC 2047 encoded-word when the header text is not plain ASCII. */
// eslint-disable-next-line no-control-regex
const headerText = (value: string): string => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${base64(value)}?=`);
const quotedName = (value: string): string => oneLine(value).replace(/["\\]/g, '_');

/** The RFC 5322 message: headers, then a base64 text body, or multipart/mixed when there are attachments. */
export function buildMimeMessage(msg: SmtpMessage, now: Date = new Date(), boundary = `kofc-${randomBytes(12).toString('hex')}`): string {
  for (const address of [msg.from, msg.to, ...(msg.replyTo ? [msg.replyTo] : [])]) {
    if (!ADDRESS.test(address)) throw new SmtpError(`"${address}" is not an address the gateway can send to or from.`);
  }
  const domain = msg.from.split('@')[1];
  const headers = [
    `From: <${msg.from}>`,
    ...(msg.replyTo ? [`Reply-To: <${msg.replyTo}>`] : []),
    `To: <${msg.to}>`,
    `Subject: ${headerText(oneLine(msg.subject))}`,
    `Date: ${now.toUTCString().replace(/GMT$/, '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
  ];
  const textPart = ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap76(base64(msg.text))];
  if (msg.attachments.length === 0) return [...headers, ...textPart].join('\r\n');
  const parts = msg.attachments.map((a) => {
    const name = quotedName(a.filename) || 'attachment';
    return [
      `Content-Type: ${oneLine(a.contentType) || 'application/octet-stream'}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      wrap76(base64(a.content)),
    ].join('\r\n');
  });
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    textPart.join('\r\n'),
    ...parts.map((p) => `--${boundary}\r\n${p}`),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** DATA payload: CRLF line ends, a leading '.' doubled (RFC 5321 4.5.2), ending with the lone-dot line. */
const dataPayload = (message: string): string => `${message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..').replace(/(\r\n)?$/, '\r\n')}.\r\n`;

interface Reply {
  code: number;
  lines: string[];
}

/** Reads whole (possibly multi-line) SMTP replies from whichever socket is attached. */
class ReplyReader {
  private buffer = '';
  private lines: string[] = [];
  private waiting: { resolve: (r: Reply) => void; reject: (e: Error) => void } | null = null;
  private failure: Error | null = null;
  private socket: net.Socket | null = null;
  private readonly onData = (chunk: Buffer) => {
    this.buffer += chunk.toString('utf8');
    let at: number;
    while ((at = this.buffer.indexOf('\n')) >= 0) {
      this.lines.push(this.buffer.slice(0, at).replace(/\r$/, ''));
      this.buffer = this.buffer.slice(at + 1);
    }
    this.flush();
  };
  private readonly onError = (err: Error) => this.fail(new SmtpError(`The connection failed: ${err.message}`));
  private readonly onClose = () => this.fail(new SmtpError('The server closed the connection.'));

  attach(socket: net.Socket): void {
    this.detach();
    this.socket = socket;
    socket.on('data', this.onData);
    socket.on('error', this.onError);
    socket.on('close', this.onClose);
  }

  detach(): void {
    this.socket?.off('data', this.onData);
    this.socket?.off('error', this.onError);
    this.socket?.off('close', this.onClose);
    this.socket = null;
  }

  fail(err: Error): void {
    this.failure ??= err;
    const w = this.waiting;
    this.waiting = null;
    w?.reject(this.failure);
  }

  next(): Promise<Reply> {
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
      if (this.failure && this.replyEnd() < 0) {
        this.fail(this.failure);
        return;
      }
      this.flush();
    });
  }

  /** The index of the last line of the first whole reply buffered, or -1. */
  private replyEnd(): number {
    return this.lines.findIndex((l) => /^\d{3}(?: |$)/.test(l));
  }

  private flush(): void {
    if (!this.waiting) return;
    const end = this.replyEnd();
    if (end < 0) return;
    const reply = this.lines.splice(0, end + 1);
    const w = this.waiting;
    this.waiting = null;
    w.resolve({ code: Number(reply[end].slice(0, 3)), lines: reply.map((l) => l.slice(4)) });
  }
}

function connect(conn: SmtpConnection, opts: SmtpOptions): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket =
      conn.port === 465
        ? tls.connect({ host: conn.host, port: conn.port, servername: conn.host, ...opts.tls }, () => resolve(socket))
        : net.connect({ host: conn.host, port: conn.port }, () => resolve(socket));
    socket.once('error', (err) => reject(new SmtpError(`Could not reach ${conn.host}:${conn.port}: ${err.message}`)));
  });
}

function upgrade(socket: net.Socket, conn: SmtpConnection, opts: SmtpOptions): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: conn.host, ...opts.tls }, () => resolve(secure));
    secure.once('error', (err) => reject(new SmtpError(`STARTTLS failed: ${err.message}`)));
  });
}

/** Sends one message through the council's SMTP server. Resolves when the server accepts it; rejects SmtpError. */
export async function sendSmtpMail(conn: SmtpConnection, msg: SmtpMessage, opts: SmtpOptions = {}): Promise<void> {
  const body = dataPayload(buildMimeMessage(msg));
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const reader = new ReplyReader();
  let socket: net.Socket = await connect(conn, opts);
  const arm = (s: net.Socket) => {
    s.setTimeout(timeoutMs, () => {
      reader.fail(new SmtpError(`${conn.host} did not answer within ${Math.round(timeoutMs / 1000)} seconds.`));
      s.destroy();
    });
    reader.attach(s);
  };
  arm(socket);

  const write = (line: string) => socket.write(`${line}\r\n`);
  const expect = async (codes: number[], step: string): Promise<Reply> => {
    const reply = await reader.next();
    if (!codes.includes(reply.code)) throw new SmtpError(`${step}: ${conn.host} answered ${reply.code} ${reply.lines.join(' ').slice(0, 200)}`);
    return reply;
  };
  const ehlo = async () => {
    write('EHLO kofc-portal');
    return (await expect([250], 'EHLO')).lines.map((l) => l.toUpperCase());
  };

  try {
    await expect([220], 'Greeting');
    let capabilities = await ehlo();
    if (!(socket instanceof tls.TLSSocket)) {
      if (!capabilities.some((c) => c.startsWith('STARTTLS'))) {
        throw new SmtpError(`${conn.host}:${conn.port} does not offer STARTTLS, so the password was not sent. Use port 465 or 587.`);
      }
      write('STARTTLS');
      await expect([220], 'STARTTLS');
      reader.detach();
      socket.setTimeout(0);
      socket = await upgrade(socket, conn, opts);
      arm(socket);
      capabilities = await ehlo();
    }

    const auth = capabilities.find((c) => c.startsWith('AUTH')) ?? '';
    if (/\bPLAIN\b/.test(auth)) {
      write(`AUTH PLAIN ${base64(`\u0000${conn.username}\u0000${conn.password}`)}`);
      await expect([235], 'Sign-in');
    } else {
      write('AUTH LOGIN');
      await expect([334], 'Sign-in');
      write(base64(conn.username));
      await expect([334], 'Sign-in');
      write(base64(conn.password));
      await expect([235], 'Sign-in');
    }

    write(`MAIL FROM:<${msg.from}>`);
    await expect([250], 'Sender');
    write(`RCPT TO:<${msg.to}>`);
    await expect([250, 251], 'Recipient');
    write('DATA');
    await expect([354], 'Message');
    socket.write(body);
    await expect([250], 'Message');
    write('QUIT');
    await expect([221], 'Quit').catch(() => undefined);
  } finally {
    reader.detach();
    socket.destroy();
  }
}
