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
const emergencyListElement = document.getElementById('emergency-list');

// Variables pour le timer
let startTime = null;
let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;
let hasRecentEmergencyStop = false;
let currentPumpState = 'off';

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

// Formater la date
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('fr-FR');
    const dateString = date.toLocaleDateString('fr-FR');
    return `${timeString} - ${dateString}`;
}

// Convertir timestamp en date lisible
function formatTimestampToDate(timestamp) {
    // Si le timestamp est en secondes, le convertir en millisecondes
    const ts = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
    return formatDateTime(ts);
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
function updatePumpStatus(pumpState, runTime = 0) {
    currentPumpState = pumpState;
    const isActive = pumpState === 'on' || pumpState === 'start';
    
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

// Créer une alerte d'arrêt d'urgence
function showEmergencyAlert(reason) {
    // Supprimer l'alerte existante si elle existe
    const existingAlert = document.querySelector('.emergency-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Créer une nouvelle alerte
    const alertDiv = document.createElement('div');
    alertDiv.className = 'emergency-alert active';
    alertDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle emergency-alert-icon"></i>
        <span class="emergency-alert-text">ARRÊT D'URGENCE: ${reason}</span>
    `;
    
    // Insérer l'alerte après le header
    const header = document.querySelector('header');
    header.insertAdjacentElement('afterend', alertDiv);
    
    // Supprimer l'alerte après 10 secondes
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 10000);
}

// Ajouter un événement à l'historique
function addHistoryEvent(event) {
    // Sauvegarder dans Firebase
    const historyRef = database.ref('history');
    historyRef.push({
        event: event,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

// Gérer le clic sur le bouton démarrer/arrêter
toggleBtn.addEventListener('click', function() {
    const isCurrentlyRunning = currentPumpState === 'on' || currentPumpState === 'start';
    const newStatus = !isCurrentlyRunning ? 'start' : 'stop';
    
    console.log('Current pump state:', currentPumpState);
    console.log('Setting new status:', newStatus);
    
    // Mettre à jour Firebase
    Promise.all([
        database.ref('start/stop').set(newStatus),
        database.ref('pumpState').set(newStatus === 'start' ? 'on' : 'off')
    ])
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
    // Écouter l'état de la pompe (pumpState - priorité)
    database.ref('pumpState').on('value', snapshot => {
        const pumpState = snapshot.val();
        console.log('PumpState changed:', pumpState);
        if (pumpState) {
            updatePumpStatus(pumpState);
        }
    });
    
    // Écouter l'état de la pompe (start/stop - backup)
    database.ref('start/stop').on('value', snapshot => {
        const status = snapshot.val();
        console.log('Start/stop changed:', status);
        // Seulement utiliser start/stop si pumpState n'est pas défini
        database.ref('pumpState').once('value', pumpStateSnapshot => {
            if (!pumpStateSnapshot.exists() && status) {
                updatePumpStatus(status);
            }
        });
    });
    
    // Écouter le temps de fonctionnement
    database.ref('runtime').on('value', snapshot => {
        const runTime = snapshot.val() || 0;
        if (!isRunning) {
            timerElement.textContent = formatTime(runTime);
        }
    });
    
    // Écouter les métriques
database.ref('sensors').on('value', snapshot => {
    const sensors = snapshot.val() || {};
    
    if (sensors.aspirationPressure !== undefined) {
        document.getElementById('aspiration-pressure').textContent = `${sensors.aspirationPressure} bar`;
    }
    
    if (sensors.refoulementPressure !== undefined) {
        document.getElementById('refoulement-pressure').textContent = `${sensors.refoulementPressure} bar`;
    }
    
    if (sensors.phaseStatus !== undefined) {
        document.getElementById('phase-status').textContent = sensors.phaseStatus;
    }
});

    
    // Écouter les arrêts d'urgence
    database.ref('emergency_stops').orderByChild('timestamp').limitToLast(10).on('value', snapshot => {
        emergencyListElement.innerHTML = '';
        
        const emergencyStops = snapshot.val() || {};
        const entries = Object.entries(emergencyStops);
        
        if (entries.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'emergency-item';
            emptyItem.innerHTML = `
                <div class="emergency-content">
                    <div class="emergency-reason">Aucun arrêt d'urgence enregistré</div>
                </div>
            `;
            emergencyListElement.appendChild(emptyItem);
            return;
        }
        
        // Trier par timestamp décroissant
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        // Vérifier s'il y a un arrêt d'urgence récent (moins de 5 minutes)
        const now = Date.now();
        const recentStop = entries.find(([key, data]) => {
            return (now - data.timestamp) < 300000; // 5 minutes
        });
        
        if (recentStop && !hasRecentEmergencyStop) {
            hasRecentEmergencyStop = true;
            showEmergencyAlert(recentStop[1].reason);
            
            // Réinitialiser après 5 minutes
            setTimeout(() => {
                hasRecentEmergencyStop = false;
            }, 300000);
        }
        
        entries.forEach(([key, data]) => {
            const emergencyItem = document.createElement('div');
            emergencyItem.className = 'emergency-item';
            
            // Vérifier si c'est un arrêt récent (moins d'une heure)
            const isRecent = (now - data.timestamp) < 3600000; // 1 heure
            
            emergencyItem.innerHTML = `
                <i class="fas fa-exclamation-triangle emergency-icon"></i>
                <div class="emergency-content">
                    <div class="emergency-reason">${data.reason}</div>
                    <div class="emergency-time">${formatTimestampToDate(data.timestamp)}</div>
                </div>
            `;
            
            if (isRecent) {
                emergencyItem.style.borderLeftColor = '#dc2626';
                emergencyItem.style.backgroundColor = '#fee2e2';
            }
            
            emergencyListElement.appendChild(emergencyItem);
        });
    });
    
    // Charger l'historique
    database.ref('history').orderByChild('timestamp').limitToLast(15).on('value', snapshot => {
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
        
        // Trier par timestamp décroissant (ou par clé si timestamp n'existe pas)
        entries.sort((a, b) => {
            const timestampA = a[1].timestamp || parseInt(a[0]) || 0;
            const timestampB = b[1].timestamp || parseInt(b[0]) || 0;
            return timestampB - timestampA;
        });
        
        entries.forEach(([key, data]) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            let eventText = '';
            let timeText = '';
            
            // Gérer les deux types d'entrées d'historique
            if (data.event) {
                // Entrée manuelle avec event et timestamp
                eventText = data.event;
                timeText = formatTimestampToDate(data.timestamp);
            } else if (data.duration !== undefined) {
                // Entrée automatique ESP32 avec duration, startTime, stopTime
                eventText = `Fonctionnement automatique (Durée: ${formatTime(data.duration)})`;
                const startTimeMs = data.startTime.toString().length === 10 ? data.startTime * 1000 : data.startTime;
                timeText = formatDateTime(startTimeMs);
            } else {
                // Entrée avec seulement une clé numérique (timestamp)
                eventText = 'Opération de pompe';
                const timestamp = parseInt(key);
                if (!isNaN(timestamp)) {
                    const ts = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
                    timeText = formatDateTime(ts);
                } else {
                    timeText = 'Date inconnue';
                }
            }
            
            historyItem.innerHTML = `
                <span>${eventText}</span>
                <span class="history-time">${timeText}</span>
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
    updatePumpStatus('off');
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