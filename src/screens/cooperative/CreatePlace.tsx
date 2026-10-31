import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text, View, Switch } from 'react-native';
import * as Crypto from 'expo-crypto';
import { fieldDocument } from "@/src/services/cooperativeFieldService";
import { api } from '@/src/services/api';
import * as Location from '@/src/services/deviceLocation';
import OperationalMap from '@/src/components/maps/OperationalMap';
import { FieldPage, FieldButton, FieldInput, ui } from '@/src/components/cooperative/FieldUI';
const initial = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  documentNumber: '',
  zipCode: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: 'CE',
  notes: '',
  acceptedMaterials: ''
};
export default function CreatePlace({
  pev = false
}: {
  pev?: boolean;
}) {
  const [form, setForm] = useState(initial),
    [type, setType] = useState<'SMALL' | 'LARGE'>('SMALL'),
    [point, setPoint] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [lookup, setLookup] = useState(false),
    [error, setError] = useState('');
  const guard = useRef(false),
    revision = useRef(0);
  const address = [form.street, form.number, form.neighborhood, form.city, form.state, form.zipCode].filter(Boolean).join(', ');
  const update = (key: keyof typeof initial, value: string) => {
    if (['zipCode', 'street', 'number', 'neighborhood', 'city', 'state'].includes(key)) {
      revision.current++;
      setConfirmed(false);
    }
    setForm(f => ({
      ...f,
      [key]: key === 'documentNumber' ? fieldDocument(value) : value
    }));
  };
  async function cep() {
    if (lookup) return;
    const value = form.zipCode.replace(/\D/g, '');
    if (value.length !== 8) {
      setError('Informe um CEP com 8 dígitos.');
      return;
    }
    const current = revision.current;
    setLookup(true);
    setError('');
    try {
      const data = await api.getExternalJson<any>('https://viacep.com.br/ws/' + value + '/json/');
      if (data.erro) throw Error('CEP não encontrado.');
      if (current !== revision.current) return;
      setForm(f => ({
        ...f,
        street: data.logradouro || f.street,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state
      }));
      revision.current++;
      setConfirmed(false);
    } catch (e: any) {
      setError(e.message || 'Não foi possível consultar o CEP. Preencha o endereço.');
    } finally {
      setLookup(false);
    }
  }
  async function locate(gps = false) {
    if (lookup) return;
    const current = revision.current;
    setLookup(true);
    setError('');
    try {
      let p;
      if (gps) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw Error('Permita o acesso à localização ou marque o ponto no mapa.');
        const v = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        p = {
          latitude: v.coords.latitude,
          longitude: v.coords.longitude
        };
      } else {
        if (!form.street || !form.city || !form.number) throw Error('Informe rua, número e cidade para buscar o endereço completo.');
        p = await api.post<{
          latitude: number;
          longitude: number;
        }>('/cooperative-field/geocode', {
          address
        }, true);
      }
      if (current !== revision.current) return;
      setPoint(p);
      setConfirmed(false);
    } catch (e: any) {
      setError(e.message || 'Não foi possível localizar. Marque o ponto no mapa.');
    } finally {
      setLookup(false);
    }
  }
  async function save() {
    if (guard.current) return;
    setError('');
    if (!form.name.trim() || !pev && !form.email.trim()) {
      setError(pev ? 'Informe o nome do PEV.' : 'Preencha nome e e-mail do gerador.');
      return;
    }
    const documentNumber = form.documentNumber.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!pev && type === 'SMALL' && ![11, 14].includes(documentNumber.length)) {
      setError('Informe CPF ou CNPJ completo. O documento define a classificação do pequeno gerador.');
      return;
    }
    if (!form.street.trim() || !form.city.trim() || !point || !confirmed) {
      setError('Preencha o endereço e confirme a localização no mapa.');
      return;
    }
    guard.current = true;
    setBusy(true);
    try {
      const common = {
        name: form.name.trim(),
        zipCode: form.zipCode.replace(/\D/g, '') || undefined,
        street: form.street.trim(),
        number: form.number.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim(),
        state: form.state.toUpperCase().trim(),
        latitude: point.latitude,
        longitude: point.longitude
      };
      if (pev) {
        const result = await api.post<{
          data: {
            id: string;
          };
        }>('/bins', {
          ...common,
          bin_id: 'PEV-' + Crypto.randomUUID().slice(0, 8).toUpperCase(),
          location: address,
          notes: form.notes.trim() || undefined,
          status: 'active',
          publicAccess: false,
          acceptedMaterials: form.acceptedMaterials.split(',').map(x => x.trim()).filter(Boolean)
        }, true);
        router.replace({
          pathname: '/(cooperativa)/pevs/[id]' as any,
          params: {
            id: result.data.id
          }
        });
      } else {
        const result = await api.post<{
          generator: {
            id: string;
          };
        }>('/generators', {
          ...common,
          type,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
          documentNumber: documentNumber || undefined,
          address
        }, true);
        router.replace({
          pathname: '/(cooperativa)/geradores/[id]',
          params: {
            id: result.generator.id
          }
        });
      }
    } catch (e: any) {
      setError(e.message || 'Não foi possível salvar. Confira os dados antes de tentar novamente.');
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  const input = (key: keyof typeof initial, label: string, options: Record<string, unknown> = {}) => <FieldInput key={key} label={label} value={form[key]} onChangeText={v => update(key, v)} editable={!busy} {...options} />;
  return <FieldPage title={pev ? 'Adicionar PEV' : 'Adicionar gerador'} subtitle={pev ? 'Cadastre um ponto de coleta da cooperativa.' : 'CPF identifica gerador residencial cadastrado; CNPJ identifica pequeno gerador.'}>{!pev && <View style={ui.row}><FieldButton secondary={type !== 'SMALL'} label="Pequeno / residencial cadastrado" disabled={busy} onPress={() => setType('SMALL')} /><FieldButton secondary={type !== 'LARGE'} label="Grande gerador" disabled={busy} onPress={() => setType('LARGE')} /></View>}<View style={ui.card}>{input('name', pev ? 'Nome do PEV *' : 'Nome / responsável *')}{!pev && <>{input('documentNumber', 'CPF/CNPJ *', {
          maxLength: 18,
          autoCapitalize: 'characters'
        })}{input('companyName', 'Empresa / razão social')}{input('email', 'E-mail *', {
          keyboardType: 'email-address',
          autoCapitalize: 'none'
        })}{input('phone', 'Telefone', {
          keyboardType: 'phone-pad'
        })}</>}</View><View style={ui.card}><Text style={ui.heading}>Endereço</Text>{input('zipCode', 'CEP', {
        keyboardType: 'number-pad',
        maxLength: 9
      })}<FieldButton secondary label="Buscar CEP" disabled={busy || lookup} onPress={() => void cep()} />{input('street', 'Rua *')}{input('number', 'Número')}{input('neighborhood', 'Bairro')}{input('city', 'Cidade *')}{input('state', 'UF *', {
        maxLength: 2,
        autoCapitalize: 'characters'
      })}<FieldButton secondary label="Buscar endereço no mapa" busy={lookup} disabled={busy} onPress={() => void locate()} /><FieldButton secondary label="Usar minha localização" disabled={lookup || busy} onPress={() => void locate(true)} /></View><View style={ui.card}><Text style={ui.heading}>Confirmar localização</Text><Text style={ui.muted}>Confira o ponto. Toque no mapa para corrigir a posição antes de confirmar.</Text><View style={{
        height: 320,
        overflow: 'hidden',
        borderRadius: 14
      }}><OperationalMap baseKind="location" baseLabel={point ? 'Local selecionado' : 'Referência da região'} baseLatitude={point?.latitude ?? -3.7319} baseLongitude={point?.longitude ?? -38.5267} points={point ? [{
          id: 'new-place',
          title: form.name || 'Novo local',
          ...point,
          kind: pev ? 'pev' : 'collection'
        }] : []} onPick={(latitude, longitude) => {
          if (!busy) {
            setPoint({
              latitude,
              longitude
            });
            setConfirmed(false);
          }
        }} showPointList={false} /></View>{point && <Text style={ui.small}>Latitude {point.latitude.toFixed(6)} · Longitude {point.longitude.toFixed(6)}</Text>}<View style={ui.row}><Switch accessibilityLabel="Confirmo a localização do cadastro" value={confirmed} disabled={!point || busy} onValueChange={setConfirmed} /><Text style={[ui.body, {
          flex: 1
        }]}>Confirmo a localização deste cadastro.</Text></View></View>{pev && <View style={ui.card}>{input('acceptedMaterials', 'Materiais aceitos (separados por vírgula)')}{input('notes', 'Orientações / observações', {
        multiline: true
      })}<Text style={ui.muted}>O PEV será criado vinculado à cooperativa, sem acesso público.</Text></View>}{!!error && <Text accessibilityRole="alert" style={{
      color: '#B42318'
    }}>{error}</Text>}<FieldButton label={pev ? 'Salvar PEV' : 'Salvar gerador'} busy={busy} disabled={lookup} onPress={() => void save()} /></FieldPage>;
}
