// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDh7WyV1PjhKiKp9PFDD3jTqjMr5iwyRIM",
    authDomain: "pompe-con-pfe.firebaseapp.com",
    projectId: "pompe-con-pfe",
    storageBucket: "pompe-con-pfe.firebasestorage.app",
    messagingSenderId: "105489087965",
    appId: "1:105489087965:web:34a65ddb286bd57eaf8a34",
    measurementId: "G-7TRB823HQE",
    databaseURL: "https://pompe-con-pfe-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Éléments DOM
const statusCircle = document.getElementById('status-circle');
const statusText = document.getElementById('status-text');
const toggleBtn = document.getElementById('toggle-btn');
const timerElement = document.getElementById('timer');
const flowRateElement = document.getElementById('flow-rate');
const temperatureElement = document.getElementById('temperature');
const powerElement = document.getElementById('power');
const historyListElement = document.getElementById('history-list');

// Variables pour le timer
let startTime = null;
let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;

// Formater le temps (HH:MM:SS)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}

// Mettre à jour le timer
function updateTimer() {
    if (isRunning) {
        const now = new Date().getTime();
        const diff = Math.floor((now - startTime) / 1000) + elapsedTime;
        timerElement.textContent = formatTime(diff);
    }
}

// Démarrer le timer
function startTimer(savedTime = 0) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    elapsedTime = savedTime || 0;
    startTime = new Date().getTime();
    isRunning = true;
    
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

// Arrêter le timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        
        if (startTime) {
            const now = new Date().getTime();
            elapsedTime += Math.floor((now - startTime) / 1000);
        }
        
        isRunning = false;
        startTime = null;
    }
}

// Mettre à jour l'état de la pompe dans l'interface
function updatePumpStatus(isActive, runTime = 0) {
    if (isActive) {
        statusCircle.classList.add('active');
        statusCircle.classList.remove('inactive');
        statusText.textContent = 'En fonctionnement';
        toggleBtn.innerHTML = '<i class="fas fa-power-off"></i><span>Arrêter</span>';
        toggleBtn.classList.add('stop');
        
        if (!isRunning) {
            startTimer(runTime);
        }
    } else {
        statusCircle.classList.remove('active');
        statusCircle.classList.add('inactive');
        statusText.textContent = 'Arrêtée';
        toggleBtn.innerHTML = '<i class="fas fa-power-off"></i><span>Démarrer</span>';
        toggleBtn.classList.remove('stop');
        
        if (isRunning) {
            stopTimer();
        }
    }
}

// Ajouter un événement à l'historique
function addHistoryEvent(event) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR');
    const dateString = now.toLocaleDateString('fr-FR');
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span>${event}</span>
        <span class="history-time">${timeString} - ${dateString}</span>
    `;
    
    historyListElement.insertBefore(historyItem, historyListElement.firstChild);
    
    // Limiter l'historique à 10 éléments
    if (historyListElement.children.length > 10) {
        historyListElement.removeChild(historyListElement.lastChild);
    }
    
    // Sauvegarder dans Firebase
    const historyRef = database.ref('history');
    historyRef.push({
        event: event,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

// Gérer le clic sur le bouton démarrer/arrêter
toggleBtn.addEventListener('click', function() {
    const newStatus = !isRunning ? 'start' : 'stop';
    
    // Mettre à jour Firebase
    database.ref('start/stop').set(newStatus)
        .then(() => {
            console.log(`Pompe ${newStatus === 'start' ? 'démarrée' : 'arrêtée'}`);
            addHistoryEvent(`Pompe ${newStatus === 'start' ? 'démarrée' : 'arrêtée'} manuellement`);
        })
        .catch(error => {
            console.error("Erreur lors de la mise à jour de l'état:", error);
            alert(`Erreur: Impossible de ${newStatus === 'start' ? 'démarrer' : 'arrêter'} la pompe`);
        });
});

// Écouter les changements dans Firebase
function setupFirebaseListeners() {
    // Écouter l'état de la pompe
    database.ref('start/stop').on('value', snapshot => {
        const status = snapshot.val();
        updatePumpStatus(status === 'start');
    });
    
    // Écouter le temps de fonctionnement
    database.ref('runtime').on('value', snapshot => {
        const runTime = snapshot.val() || 0;
        if (!isRunning) {
            timerElement.textContent = formatTime(runTime);
        }
    });
    
    // Écouter les métriques
    database.ref('metrics').on('value', snapshot => {
        const metrics = snapshot.val() || {};
        
        if (metrics.flowRate !== undefined) {
            flowRateElement.textContent = `${metrics.flowRate} L/min`;
        }
        
        if (metrics.temperature !== undefined) {
            temperatureElement.textContent = `${metrics.temperature} °C`;
        }
        
        if (metrics.power !== undefined) {
            powerElement.textContent = `${metrics.power} W`;
        }
    });
    
    // Charger l'historique
    database.ref('history').orderByChild('timestamp').limitToLast(10).on('value', snapshot => {
        historyListElement.innerHTML = '';
        
        const history = snapshot.val() || {};
        const entries = Object.entries(history);
        
        if (entries.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'history-item';
            emptyItem.textContent = 'Aucun événement enregistré';
            historyListElement.appendChild(emptyItem);
            return;
        }
        
        // Trier par timestamp décroissant
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        entries.forEach(([key, data]) => {
            const date = new Date(data.timestamp);
            const timeString = date.toLocaleTimeString('fr-FR');
            const dateString = date.toLocaleDateString('fr-FR');
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <span>${data.event}</span>
                <span class="history-time">${timeString} - ${dateString}</span>
            `;
            
            historyListElement.appendChild(historyItem);
        });
    });
}

// Initialiser l'application
function initApp() {
    // Vérifier la connexion à Firebase
    database.ref('.info/connected').on('value', snapshot => {
        const connected = snapshot.val();
        if (connected) {
            console.log('Connecté à Firebase');
            setupFirebaseListeners();
        } else {
            console.log('Déconnecté de Firebase');
            statusText.textContent = 'Hors ligne';
            statusCircle.classList.remove('active', 'inactive');
        }
    });
    
    // Initialiser l'état par défaut
    updatePumpStatus(false);
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', initApp);

// Sauvegarder le temps de fonctionnement dans Firebase périodiquement
setInterval(() => {
    if (isRunning) {
        const now = new Date().getTime();
        const currentElapsedTime = Math.floor((now - startTime) / 1000) + elapsedTime;
        database.ref('runtime').set(currentElapsedTime);
    }
}, 10000); // Toutes les 10 secondes