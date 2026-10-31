import { router } from 'expo-router';
import { Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { NotificationBell } from '@/src/components/NotificationBell';
import { FieldPage, FieldButton, ui, green } from '@/src/components/cooperative/FieldUI';
const actions = [['Catadores', 'Trabalhos, equipe e pendências', 'people-outline', 'catadores'], ['Motoristas', 'Trabalhos e localização ao vivo', 'car-outline', 'motoristas'], ['Geradores', 'Locais, solicitações e coletas', 'business-outline', 'geradores'], ['Adicionar gerador', 'Cadastrar pequeno ou grande gerador', 'person-add-outline', 'geradores/novo'], ['PEVs', 'Localizar, cadastrar e consultar no mapa', 'location-outline', 'pevs'], ['Relatórios e análises', 'Escolher indicadores e período', 'bar-chart-outline', 'relatorios']] as const;
export default function CooperativeHome() {
  const {
    user,
    signOut
  } = useAuth();
  return <FieldPage home title="Gestão em campo" subtitle="Escolha o que precisa consultar ou registrar agora."><View style={[ui.row, {
      justifyContent: 'space-between'
    }]}><Text style={ui.muted}>{user?.cooperative?.name || user?.displayName || 'Cooperativa'}</Text><NotificationBell tone="dark" /></View><View style={{
      gap: 12
    }}>{actions.map(([title, description, icon, path]) => <Pressable key={path} accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push('/(cooperativa)/' + path as any)} style={[ui.card, {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
      }]}><View style={{
          padding: 14,
          backgroundColor: '#EAF5EE',
          borderRadius: 16
        }}><Ionicons name={icon} color={green} size={27} /></View><View style={{
          flex: 1,
          gap: 4
        }}><Text style={ui.heading}>{title}</Text><Text style={ui.muted}>{description}</Text></View><Ionicons name="chevron-forward" color={green} size={20} /></Pressable>)}</View><FieldButton label="Sair da conta" secondary onPress={() => void signOut()} /></FieldPage>;
}
