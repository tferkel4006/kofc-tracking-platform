// New message: pick one or more people from my council and its affiliated councils, write, send.
// The person list follows the spec: "Last, First – Council name", sorted by council name then last name.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { memberDropdownOptions, sortCouncils } from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { AppInput, AppText, Button, Field, Loading, Notice, Pill } from '@/components/ui';
import { useApp, useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

export default function NewMessageScreen() {
  const user = useUser();
  const router = useRouter();
  const { refreshUnread } = useApp();
  const [recipients, setRecipients] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const state = useLoad(async () => {
    const [own, affiliated] = await Promise.all([db.councils.get(user.councilId), db.councils.listAffiliated(user.councilId)]);
    const councils = sortCouncils([...(own ? [own] : []), ...affiliated]);
    const rosters = await Promise.all(councils.map((c) => db.members.listByCouncil(c.id, { activeOnly: true })));
    const members = rosters.flat().filter((m) => m.id !== user.memberId);
    return { options: memberDropdownOptions(members, councils) };
  }, [user.memberId, user.councilId]);

  const options = state.data?.options ?? [];
  const labelOf = (id: number) => options.find((o) => o.value === id)?.label ?? `Member ${id}`;

  const send = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const sent = await db.messages.send({ senderId: user.memberId, councilId: user.councilId, recipientIds: recipients, text });
      await refreshUnread();
      router.replace(`/messages/${sent.ThreadID}`);
    } catch (err) {
      setFailure(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="label" style={{ textDecorationLine: 'underline' }}>
            ‹ Messages
          </AppText>
        </Pressable>
        <AppText variant="heading" accessibilityRole="header">
          New message
        </AppText>
        {failure ? <Notice tone="error" message={failure} onDismiss={() => setFailure(null)} /> : null}
        {state.error ? <Notice tone="error" message={state.error} /> : null}
        {!state.data && state.loading ? <Loading /> : null}

        <Field label="TO">
          <Dropdown
            title="Add a person"
            placeholder="Add a person…"
            value={null}
            options={options.filter((o) => !recipients.includes(o.value))}
            onChange={(id) => setRecipients((r) => [...r, id])}
          />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {recipients.map((id) => (
            <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Remove ${labelOf(id)}`} onPress={() => setRecipients((r) => r.filter((x) => x !== id))}>
              <Pill label={`${labelOf(id)}  ×`} tone="outline" />
            </Pressable>
          ))}
        </View>

        <Field label="MESSAGE">
          <AppInput value={text} onChangeText={setText} multiline style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: space.md }} />
        </Field>
        <Button title="Send" busy={busy} disabled={recipients.length === 0 || !text.trim()} onPress={() => void send()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
