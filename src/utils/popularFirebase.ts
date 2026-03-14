import { collection, addDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../services/firebaseConfig";
import { Alert } from "react-native";

export async function popularDadosCooperativa() {
  try {
    Alert.alert("Iniciando", "Populando dados da cooperativa...");

    // 1. Criar usuário cooperativa
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      "cooperativa@katu.com",
      "123456"
    );
    
    const cooperativaId = userCredential.user.uid;
    
    // 2. Salvar dados da cooperativa
    await addDoc(collection(db, "users"), {
      uid: cooperativaId,
      email: "cooperativa@katu.com",
      displayName: "Cooperativa da Jeri",
      userType: "cooperativa",
      cooperativeName: "Cooperativa da Jeri",
      registrationNumber: "00.000.000/0001-00",
      createdAt: new Date()
    });

    // 3. Criar motoristas
    const motoristas = [
      { nome: "João Silva", cpf: "000.000.000-01", telefone: "(88) 98888-1111", email: "joao@email.com" },
      { nome: "Maria Santos", cpf: "000.000.000-02", telefone: "(88) 98888-2222", email: "maria@email.com" },
      { nome: "José Oliveira", cpf: "000.000.000-03", telefone: "(88) 98888-3333", email: "jose@email.com" },
    ];

    for (const m of motoristas) {
      await addDoc(collection(db, "motoristas"), {
        ...m,
        status: "disponivel",
        cooperativaId,
        createdAt: new Date()
      });
    }

    // 4. Criar veículos
    const veiculos = [
      { placa: "ABC1A23", modelo: "Fiorino", capacidade: 800, status: "ativo" },
      { placa: "XYZ4B56", modelo: "Kombi", capacidade: 600, status: "ativo" },
      { placa: "JKL7C89", modelo: "Caminhão", capacidade: 3000, status: "manutencao" },
    ];

    for (const v of veiculos) {
      await addDoc(collection(db, "veiculos"), {
        ...v,
        cooperativaId,
        createdAt: new Date()
      });
    }

    // 5. Criar rotas
    const rotas = [
      { nome: "Rota Centro", status: "em_andamento", pontos: 5 },
      { nome: "Rota Praia", status: "agendada", pontos: 3 },
    ];

    for (const r of rotas) {
      await addDoc(collection(db, "rotas"), {
        ...r,
        motoristaId: "",
        veiculoId: "",
        data: new Date(),
        cooperativaId,
        createdAt: new Date()
      });
    }

    // 6. Criar alertas
    const alertas = [
      {
        titulo: "Coleta atrasada",
        descricao: "Atacadão do Vale aguardando coleta há 2 dias",
        tipo: "atraso",
        status: "pendente",
        prioridade: "alta",
        cooperativaId,
        createdAt: new Date()
      },
      {
        titulo: "Material acumulado",
        descricao: "Bar do Valmal com excesso de material",
        tipo: "acumulo",
        status: "pendente",
        prioridade: "media",
        cooperativaId,
        createdAt: new Date()
      },
      {
        titulo: "Solicitação de coleta",
        descricao: "Mercadinho Nova Opção solicitou coleta",
        tipo: "solicitacao",
        status: "pendente",
        prioridade: "baixa",
        cooperativaId,
        createdAt: new Date()
      }
    ];

    for (const a of alertas) {
      await addDoc(collection(db, "alertas"), a);
    }

    Alert.alert(
      "✅ Sucesso!", 
      `Dados populados com sucesso!\n\nEmail: cooperativa@katu.com\nSenha: 123456\n\nCooperativa ID: ${cooperativaId}`
    );

  } catch (error: any) {
    console.error("Erro ao popular:", error);
    Alert.alert("Erro", error.message);
  }
}