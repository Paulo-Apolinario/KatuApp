import { useAuth } from "@/src/contexts/AuthContext";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useDurableDraft } from "@/src/hooks/useDurableDraft";
import { queueCooperativeCreate, newCreateOperation } from "@/src/offline/cooperativeCreate";
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text, View, Switch } from 'react-native';
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
export default function CreatePlace({ pev = false }: {
    pev?: boolean;
}) {
    const params = useLocalSearchParams<{ draft?: string }>();
    const [newId] = useState(newCreateOperation);
    const operationId = typeof params.draft === 'string' && /^[a-f0-9-]{36}$/i.test(params.draft) ? params.draft : null;
    // Mount the editable form only after its durable reference is in the URL.
    // Redirecting after typing can remount the screen and discard the first changes.
    if (!operationId) return <Redirect href={{ pathname: pev ? '/(cooperativa)/pevs/novo' : '/(cooperativa)/geradores/novo', params: { draft: newId } } as any} />;
    return <CreatePlaceForm key={operationId} pev={pev} operationId={operationId} />;
}
function CreatePlaceForm({ pev, operationId }: { pev: boolean; operationId: string }) {
    const { user } = useAuth();
    const [form, setForm] = useState(initial), [type, setType] = useState<'SMALL' | 'LARGE'>('SMALL'), [point, setPoint] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [lookup, setLookup] = useState(false), [error, setError] = useState('');
    const guard = useRef(false), lookupGuard = useRef(false), revision = useRef(0), latest = useRef(form), autoCep=useRef(''), resolvedCep=useRef(''), autoAddress=useRef('');
    const draft = useDurableDraft('create:' + operationId, pev ? 'Novo PEV' : 'Novo gerador', { form, type, point, confirmed, pev, resolvedCep: resolvedCep.current }, v => { latest.current = v.form; resolvedCep.current = typeof v.resolvedCep === 'string' ? v.resolvedCep : v.point && v.confirmed ? v.form.zipCode.replace(/\D/g, '') : '';  autoCep.current = resolvedCep.current; autoAddress.current = [v.form.street, v.form.number, v.form.neighborhood, v.form.city, v.form.state, v.form.zipCode].filter(Boolean).join(', '); setForm(v.form); setType(v.type); setPoint(v.point); setConfirmed(v.confirmed); }, JSON.stringify(form) !== JSON.stringify(initial) || point !== null);
    latest.current=form;
    const address = [form.street, form.number, form.neighborhood, form.city, form.state, form.zipCode].filter(Boolean).join(', ');
    useEffect(()=>{const zip=form.zipCode.replace(/\D/g,'');if((typeof navigator!=='undefined'&&navigator.onLine===false)||(point&&confirmed)||!draft.ready||lookup||zip.length!==8||autoCep.current===zip)return;const timer=setTimeout(()=>{autoCep.current=zip;void cep();},500);return()=>clearTimeout(timer);},[form.zipCode,lookup,draft.ready]);
    useEffect(()=>{if((typeof navigator!=='undefined'&&navigator.onLine===false)||(point&&confirmed)||!draft.ready||lookup||!form.street.trim()||!form.city.trim()||!form.number.trim()||form.zipCode.replace(/\D/g,'').length!==8||resolvedCep.current!==form.zipCode.replace(/\D/g,''))return;const key=address;if(autoAddress.current===key)return;const timer=setTimeout(()=>{if(autoAddress.current===key)return;autoAddress.current=key;void locate(false);},900);return()=>clearTimeout(timer);},[address,lookup,draft.ready]);
    const update = (key: keyof typeof initial, value: string) => {
        if (latest.current[key] === value) return;
        if (['zipCode', 'street', 'number', 'neighborhood', 'city', 'state'].includes(key)) {
            revision.current++;
            setConfirmed(false);
            setPoint(null);
            autoAddress.current = '';
            if (key === 'zipCode') {
                resolvedCep.current = '';
                autoCep.current = '';
            }
        }
        const next = { ...latest.current, [key]: key === 'documentNumber' ? fieldDocument(value) : value };
        latest.current = next;
        setForm(next);
    };
    async function cep() {
        if (lookupGuard.current) return;
        const snapshot = { ...latest.current }, current = revision.current;
        const value = snapshot.zipCode.replace(/\D/g, '');
        if (value.length !== 8) {
            setError('Informe um CEP com 8 dígitos.');
            return;
        }
        lookupGuard.current = true;
        autoCep.current = value;
        setLookup(true);
        setError('');
        setPoint(null);
        setConfirmed(false);
        resolvedCep.current = '';
        try {
            const data = await api.getExternalJson<any>('https://viacep.com.br/ws/' + value + '/json/');
            if (current !== revision.current) return;
            if (data.erro) throw Error('CEP não encontrado.');
            const next = {
                ...latest.current,
                // A new CEP must replace the previous address, including empty street fields.
                street: data.logradouro || '',
                neighborhood: data.bairro || '',
                city: data.localidade || '',
                state: data.uf || ''
            };
            latest.current = next;
            setForm(next);
            revision.current++;
            resolvedCep.current = value;
            autoAddress.current = '';
        }
        catch (e: any) {
            if (current === revision.current)
                setError(e.message || 'Não foi possível consultar o CEP. Preencha o endereço.');
        }
        finally {
            lookupGuard.current = false;
            setLookup(false);
        }
    }
    async function locate(gps = false) {
        if (lookupGuard.current) return;
        const current = revision.current, snapshot = { ...latest.current };
        const requestedAddress = [snapshot.street, snapshot.number, snapshot.neighborhood, snapshot.city, snapshot.state, snapshot.zipCode].filter(Boolean).join(', ');
        lookupGuard.current = true;
        setLookup(true);
        setError('');
        setPoint(null);
        setConfirmed(false);
        try {
            let p;
            if (gps) {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (!permission.granted)
                    throw Error('Permita o acesso à localização ou marque o ponto no mapa.');
                const v = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                p = { latitude: v.coords.latitude, longitude: v.coords.longitude };
            }
            else {
                if (!snapshot.street.trim() || !snapshot.city.trim() || !snapshot.number.trim())
                    throw Error('Informe rua, número e cidade para buscar o endereço completo.');
                if (snapshot.zipCode.replace(/\D/g, '').length && resolvedCep.current !== snapshot.zipCode.replace(/\D/g, ''))
                    throw Error('Busque o novo CEP antes de localizar o endereço no mapa.');
                p = await api.post<{ latitude: number; longitude: number }>('/cooperative-field/geocode', { address: requestedAddress }, true);
            }
            if (current !== revision.current) return;
            autoAddress.current = requestedAddress;
            setPoint(p);
        }
        catch (e: any) {
            if (current === revision.current)
                setError(e.message || 'Não foi possível localizar. Marque o ponto no mapa.');
        }
        finally {
            lookupGuard.current = false;
            setLookup(false);
        }
    }
    async function save() {
        if (draft.error) {
            setError('O rascunho ainda não foi salvo neste aparelho. Resolva o aviso de armazenamento e tente novamente.');
            return;
        }
        if (!draft.ready || draft.saving) {
            setError("Aguarde o salvamento do rascunho no aparelho.");
            return;
        }
        if (guard.current)
            return;
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
            const data = pev ? { ...common, bin_id: 'PEV-' + operationId.slice(0, 8).toUpperCase(), location: address, notes: form.notes.trim() || undefined, status: 'active', publicAccess: false, acceptedMaterials: form.acceptedMaterials.split(',').map(x => x.trim()).filter(Boolean) } : { ...common, type, email: form.email.trim(), phone: form.phone.trim() || undefined, companyName: form.companyName.trim() || undefined, documentNumber: documentNumber || undefined, address };
            await queueCooperativeCreate(operationId, pev ? 'PEV_CREATE' : 'GENERATOR_CREATE', data, user!.id);
            await draft.clear();
            router.replace({ pathname: '/(cooperativa)/cadastro-pendente' as any, params: { id: operationId } });
        }
        catch (e: any) {
            setError(e.message || 'Não foi possível salvar. Confira os dados antes de tentar novamente.');
        }
        finally {
            setBusy(false);
            guard.current = false;
        }
    }
    const input = (key: keyof typeof initial, label: string, options: Record<string, unknown> = {}) => <FieldInput key={key} label={label} value={form[key]} onChangeText={v => update(key, v)} editable={!busy && draft.ready} {...options}/>;
    return <FieldPage title={pev ? 'Adicionar PEV' : 'Adicionar gerador'} subtitle={pev ? 'Cadastre um ponto de coleta da cooperativa.' : 'CPF identifica gerador residencial cadastrado; CNPJ identifica pequeno gerador.'}>{!pev && <View style={ui.row}><FieldButton secondary={type !== 'SMALL'} label="Pequeno / residencial cadastrado" disabled={busy} onPress={() => setType('SMALL')}/><FieldButton secondary={type !== 'LARGE'} label="Grande gerador" disabled={busy} onPress={() => setType('LARGE')}/></View>}<View style={ui.card}>{input('name', pev ? 'Nome do PEV *' : 'Nome / responsável *')}{!pev && <>{input('documentNumber', 'CPF/CNPJ *', {
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
        })}<FieldButton secondary label="Buscar CEP" disabled={busy || lookup} onPress={() => void cep()}/>{input('street', 'Rua *')}{input('number', 'Número')}{input('neighborhood', 'Bairro')}{input('city', 'Cidade *')}{input('state', 'UF *', {
            maxLength: 2,
            autoCapitalize: 'characters'
        })}<FieldButton secondary label="Buscar endereço no mapa" busy={lookup} disabled={busy} onPress={() => void locate()}/><FieldButton secondary label="Usar minha localização" disabled={lookup || busy} onPress={() => void locate(true)}/></View><View style={ui.card}><Text style={ui.heading}>Confirmar localização</Text><Text style={ui.muted}>O CEP preenche a rua e o número aciona a busca do endereço completo. A posição depende da base de mapas: confira o ponto e corrija no mapa antes de confirmar.</Text><View style={{
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
                revision.current++;
                autoAddress.current = address;
                setError('');
                setPoint({
                    latitude,
                    longitude
                });
                setConfirmed(false);
            }
        }} showPointList={false}/></View>{point && <Text style={ui.small}>Latitude {point.latitude.toFixed(6)} · Longitude {point.longitude.toFixed(6)}</Text>}<View style={ui.row}><Switch accessibilityLabel="Confirmo a localização do cadastro" value={confirmed} disabled={!point || busy || lookup} onValueChange={setConfirmed}/><Text style={[ui.body, {
                flex: 1
            }]}>Confirmo a localização deste cadastro.</Text></View></View>{pev && <View style={ui.card}>{input('acceptedMaterials', 'Materiais aceitos (separados por vírgula)')}{input('notes', 'Orientações / observações', {
                multiline: true
            })}<Text style={ui.muted}>O PEV será criado vinculado à cooperativa, sem acesso público.</Text></View>}{draft.saving && <Text style={ui.muted}>Salvando rascunho no aparelho...</Text>}{!!draft.savedAt && !draft.saving && !draft.error && <Text style={ui.badge}>Rascunho salvo neste aparelho.</Text>}{!!draft.error && <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{draft.error}</Text>}{!!error && <Text accessibilityRole="alert" style={{
                color: '#B42318'
            }}>{error}</Text>}<FieldButton label={pev ? 'Salvar PEV' : 'Salvar gerador'} busy={busy} disabled={lookup || !draft.ready || draft.saving} onPress={() => void save()}/></FieldPage>;
}
