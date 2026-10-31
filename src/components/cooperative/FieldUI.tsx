import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export const green = '#087B55';
export const ui = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F1F6F3'
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    gap: 14
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#153D2C'
  },
  heading: {
    fontSize: 19,
    fontWeight: '700',
    color: '#153D2C'
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: '#374F44'
  },
  muted: {
    fontSize: 13,
    lineHeight: 20,
    color: '#61756A'
  },
  card: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DBE7DF',
    gap: 10
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#BCCFC2',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 50,
    color: '#1B3D2C'
  },
  badge: {
    color: green,
    fontWeight: '700',
    fontSize: 13
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: green,
    borderRadius: 12,
    padding: 13,
    justifyContent: 'center',
    alignItems: 'center'
  },
  small: {
    fontSize: 12,
    color: '#61756A'
  },
  link: {
    fontWeight: '700',
    color: green
  }
});
export function FieldPage({
  title,
  subtitle,
  children,
  home = false,
  homeHref = '/(cooperativa)/home'
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  home?: boolean;
  homeHref?: string;
}) {
  return <ScrollView style={ui.page} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">{!home && <View style={ui.row}><FieldButton label="Voltar" secondary onPress={() => router.canGoBack() ? router.back() : router.replace(homeHref as any)} /><FieldButton label="Início" secondary onPress={() => router.replace(homeHref as any)} /></View>}<Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={ui.muted}>{subtitle}</Text>}{children}</ScrollView>;
}
export function FieldButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{
    disabled: disabled || busy,
    busy
  }} disabled={disabled || busy} onPress={onPress} style={[ui.button, {
    backgroundColor: secondary ? 'white' : green,
    opacity: disabled || busy ? 0.5 : 1
  }]}>{busy ? <ActivityIndicator color={secondary ? green : 'white'} /> : <View style={[ui.row, {
      justifyContent: 'center'
    }]}>{icon && <Ionicons name={icon} size={21} color={secondary ? green : 'white'} />}<Text style={{
        color: secondary ? green : 'white',
        fontWeight: '700',
        fontSize: 14
      }}>{label}</Text></View>}</Pressable>;
}
export function FieldInput({
  label,
  value,
  onChangeText,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
}) {
  return <View style={{
    gap: 6
  }}><Text style={ui.body}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} {...props} style={ui.input} /></View>;
}
export function useFieldData<T>(loader: () => Promise<T>, poll = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useFocusEffect(useCallback(() => {
    let alive = true,
      busy = false;
    const id = ++sequence.current;
    setData(null);
    async function load() {
      if (!alive || busy || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      busy = true;
      setLoading(true);
      try {
        const result = await loader();
        if (alive && sequence.current === id) {
          setData(result);
          setError('');
        }
      } catch (e: any) {
        if (alive && sequence.current === id) setError(e.message || 'Não foi possível carregar. Tente novamente.');
      } finally {
        busy = false;
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = poll ? setInterval(load, poll) : null;
    const s = AppState.addEventListener('change', v => {
      if (v === 'active') void load();
    });
    return () => {
      alive = false;
      sequence.current++;
      if (timer) clearInterval(timer);
      s.remove();
    };
  }, [loader, poll, revision]));
  return {
    data,
    error,
    loading,
    refresh: () => setRevision(n => n + 1)
  };
}
export function LoadState({
  resource
}: {
  resource: {
    data: unknown;
    error: string;
    loading: boolean;
    refresh: () => void;
  };
}) {
  return <>{resource.loading && !resource.data && <ActivityIndicator accessibilityLabel="Carregando" color={green} />} {!!resource.error && <View style={ui.card}><Text accessibilityRole="alert" style={{
        color: '#B42318'
      }}>{resource.error}</Text><FieldButton secondary label="Tentar novamente" onPress={resource.refresh} /></View>}</>;
}
export function Pager({
  pagination,
  onPage
}: {
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
  };
  onPage: (n: number) => void;
}) {
  return pagination ? <View style={ui.card}><Text style={ui.muted}>{pagination.total} registro(s) · Página {pagination.page} de {pagination.totalPages}</Text><View style={ui.row}><FieldButton secondary label="Anterior" disabled={pagination.page <= 1} onPress={() => onPage(pagination.page - 1)} /><FieldButton secondary label="Próxima" disabled={pagination.page >= pagination.totalPages} onPress={() => onPage(pagination.page + 1)} /></View></View> : null;
}
