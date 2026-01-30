const firebaseConfig = {
  apiKey: "AIzaSyAj0rrafC66HTzom12Pi7M61eISGRoPVYo", // Chave da sua Foto 7
  authDomain: "miraculous-uno.firebaseapp.com",
  databaseURL: "https://miraculous-uno-default-rtdb.firebaseio.com", // URL da sua Foto 10
  projectId: "miraculous-uno",
  storageBucket: "miraculous-uno.firebasestorage.app",
  messagingSenderId: "941387013652",
  appId: "1:941387013652:web:61ad9c992105d3bebcd101"
};

// Inicialização
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.db = firebase.database(); // Isso conecta o jogo ao banco da Foto 10