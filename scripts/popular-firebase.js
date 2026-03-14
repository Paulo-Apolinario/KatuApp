const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

// Sua config do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD6IRXDwKGQM--i0U1uIIdHARlqI41K7t8",
  authDomain: "katuapp-89a18.firebaseapp.com",
  projectId: "katuapp-89a18",
  storageBucket: "katuapp-89a18.firebasestorage.app",
  messagingSenderId: "1063154391684",
  appId: "1:1063154391684:web:27689da196afe10cbfc0d1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function popularDados() {
  try {
    // 1. Criar usuário cooperativa
    const cooperativaUser = await createUserWithEmailAndPassword(
      auth,
      "cooperativa@katu.com",
      "123456"
    );
    
    const cooperativaId = cooperativaUser.user.uid;
    
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

    // 3. Criar motoristas de exemplo
    const motoristas = [
      { nome: "João Silva", cpf: "000.000.000-01", telefone: "(88) 98888-1111", email: "joao@email.com" },
      { nome: "Maria Santos", cpf: "000.000.000-02", telefone: "(88) 98888-2222", email: "maria@email.com" },
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
    ];

    for (const v of veiculos) {
      await addDoc(collection(db, "veiculos"), {
        ...v,
        cooperativaId,
        createdAt: new Date()
      });
    }

    // 5. Criar alertas de exemplo
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
      }
    ];

    for (const a of alertas) {
      await addDoc(collection(db, "alertas"), a);
    }

    console.log("✅ Dados populados com sucesso!");
    console.log("Cooperativa ID:", cooperativaId);
    console.log("Email: cooperativa@katu.com");
    console.log("Senha: 123456");

  } catch (error) {
    console.error("Erro ao popular:", error);
  }
}

popularDados();