/**
 * Script para página Home estilo Spotify
 */

const API_URL = 'http://localhost:3000/api/v1';
const token = localStorage.getItem('token');

// Verificar se está logado
if (!token) {
    window.location.href = '/index.html';
}

// Estado global do player
let currentAudio = null;
let currentMusica = null;
let isPlaying = false;
let userData = null;

// Elementos do DOM
const greeting = document.getElementById('greeting');
const nowPlaying = document.getElementById('nowPlaying');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArtist = document.getElementById('nowPlayingArtist');
const nowPlayingImage = document.getElementById('nowPlayingImage');
const bottomPlayer = document.getElementById('bottomPlayer');
const playerTrackTitle = document.getElementById('playerTrackTitle');
const playerTrackArtist = document.getElementById('playerTrackArtist');
const playerTrackImage = document.getElementById('playerTrackImage');
const playPauseBtn = document.getElementById('playPauseBtn');
const playerPlayPauseBtn = document.getElementById('playerPlayPauseBtn');
const quickAccessGrid = document.getElementById('quickAccessGrid');
const playlistsScroll = document.getElementById('playlistsScroll');
const recommendationsScroll = document.getElementById('recommendationsScroll');
const sidebarPlaylists = document.getElementById('sidebarPlaylists');
const userAvatar = document.getElementById('userAvatar');
const searchInput = document.getElementById('searchInput');

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    loadQuickAccess();
    loadPlaylists();
    loadRecommendations();
    loadSidebarPlaylists();
    setupEventListeners();
    updateGreeting();
    checkForPlayingMusic();
});

// Atualizar saudação baseada na hora
function updateGreeting() {
    const hour = new Date().getHours();
    let greetingText = 'Boa noite';
    if (hour >= 5 && hour < 12) greetingText = 'Bom dia';
    else if (hour >= 12 && hour < 18) greetingText = 'Boa tarde';
    greeting.textContent = greetingText;
}

// Carregar dados do usuário
async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            userData = data.data.user;
            const firstName = userData.nomeUsuario?.split(' ')[0] || userData.fullName?.split(' ')[0] || 'Usuário';
            greeting.textContent = `${greeting.textContent}, ${firstName}`;
            userAvatar.textContent = firstName.charAt(0).toUpperCase();
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

// Carregar acesso rápido
async function loadQuickAccess() {
    try {
        // Músicas Curtidas
        const favoritosResponse = await fetch(`${API_URL}/favoritos/meus?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let favoritosCount = 0;
        if (favoritosResponse.ok) {
            const favoritosData = await favoritosResponse.json();
            favoritosCount = favoritosData.pagination?.total || 0;
        }

        quickAccessGrid.innerHTML = `
            <div class="card" data-action="favoritos">
                <div class="card-image" style="background: linear-gradient(135deg, #450af5 0%, #c4efd9 100%);">
                    <div style="font-size: 48px;">❤️</div>
                </div>
                <div class="card-title">Músicas Curtidas</div>
                <div class="card-subtitle">${favoritosCount} músicas</div>
                <div class="play-button-overlay">▶</div>
            </div>
        `;
        
        // Adicionar event listener para o card de favoritos
        const favoritosCard = quickAccessGrid.querySelector('[data-action="favoritos"]');
        if (favoritosCard) {
            favoritosCard.addEventListener('click', async () => {
                await playFavoritos();
            });
        }
    } catch (error) {
        console.error('Erro ao carregar acesso rápido:', error);
    }
}

// Carregar playlists do usuário
async function loadPlaylists() {
    try {
        const response = await fetch(`${API_URL}/playlists/minhas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok && data.success && data.data.length > 0) {
            playlistsScroll.innerHTML = data.data.map(playlist => {
                const imageUrl = playlist.capa?.url || '';
                const totalMusicas = playlist.stats?.totalMusicas || 0;
                
                return `
                    <div class="horizontal-card" data-playlist-id="${playlist._id}">
                        <div class="horizontal-card-image">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${playlist.nomePlaylist}">` : 
                                `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🎵</div>`}
                        </div>
                        <div class="card-title">${playlist.nomePlaylist}</div>
                        <div class="card-subtitle">${totalMusicas} músicas</div>
                    </div>
                `;
            }).join('');
            
            // Adicionar event listeners para as playlists
            playlistsScroll.querySelectorAll('[data-playlist-id]').forEach(card => {
                card.addEventListener('click', async () => {
                    const playlistId = card.getAttribute('data-playlist-id');
                    await playPlaylist(playlistId);
                });
            });
        } else {
            playlistsScroll.innerHTML = '<div style="padding: 20px; color: #b3b3b3;">Nenhuma playlist encontrada</div>';
        }
    } catch (error) {
        console.error('Erro ao carregar playlists:', error);
        playlistsScroll.innerHTML = '<div style="padding: 20px; color: #b3b3b3;">Erro ao carregar playlists</div>';
    }
}

// Carregar recomendações
async function loadRecommendations() {
    try {
        const response = await fetch(`${API_URL}/busca/populares?limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok && data.success && data.data.length > 0) {
            recommendationsScroll.innerHTML = data.data.slice(0, 10).map(musica => {
                const imageUrl = musica.capa?.url || '';
                
                return `
                    <div class="horizontal-card" data-musica-id="${musica._id}" data-musica-titulo="${musica.titulo.replace(/"/g, '&quot;')}" data-musica-autor="${musica.autor.replace(/"/g, '&quot;')}" data-musica-image="${imageUrl.replace(/"/g, '&quot;')}">
                        <div class="horizontal-card-image">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${musica.titulo}">` : 
                                `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🎵</div>`}
                        </div>
                        <div class="card-title">${musica.titulo}</div>
                        <div class="card-subtitle">${musica.autor}</div>
                    </div>
                `;
            }).join('');
            
            // Adicionar event listeners para as músicas recomendadas
            recommendationsScroll.querySelectorAll('[data-musica-id]').forEach(card => {
                card.addEventListener('click', () => {
                    const musicaId = card.getAttribute('data-musica-id');
                    const titulo = card.getAttribute('data-musica-titulo');
                    const autor = card.getAttribute('data-musica-autor');
                    const imageUrl = card.getAttribute('data-musica-image');
                    playMusica(musicaId, titulo, autor, imageUrl);
                });
            });
        } else {
            recommendationsScroll.innerHTML = '<div style="padding: 20px; color: #b3b3b3;">Nenhuma recomendação disponível</div>';
        }
    } catch (error) {
        console.error('Erro ao carregar recomendações:', error);
        recommendationsScroll.innerHTML = '<div style="padding: 20px; color: #b3b3b3;">Erro ao carregar recomendações</div>';
    }
}

// Carregar playlists na sidebar
async function loadSidebarPlaylists() {
    try {
        const response = await fetch(`${API_URL}/playlists/minhas?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok && data.success && data.data.length > 0) {
            sidebarPlaylists.innerHTML = data.data.map(playlist => `
                <a href="/playlist.html?id=${playlist._id}" class="playlist-link">${playlist.nomePlaylist}</a>
            `).join('');
        } else {
            sidebarPlaylists.innerHTML = '<div class="playlist-link" style="color: #b3b3b3;">Nenhuma playlist</div>';
        }
    } catch (error) {
        console.error('Erro ao carregar playlists da sidebar:', error);
        sidebarPlaylists.innerHTML = '<div class="playlist-link" style="color: #b3b3b3;">Erro ao carregar</div>';
    }
}

// Reproduzir música
function playMusica(musicaId, titulo, autor, imageUrl) {
    // Parar música atual se houver
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    currentMusica = { _id: musicaId, titulo, autor, imageUrl };
    
    // Criar URL com token
    const audioUrl = `${API_URL}/streaming/stream/${musicaId}?token=${encodeURIComponent(token)}`;
    
    // Criar elemento de áudio
    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 1;

    // Event listeners
    currentAudio.addEventListener('loadedmetadata', () => {
        const totalTime = document.getElementById('playerTotalTime');
        if (totalTime) totalTime.textContent = formatTime(currentAudio.duration);
    });

    currentAudio.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButtons();
    });

    currentAudio.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButtons();
    });

    currentAudio.addEventListener('ended', () => {
        isPlaying = false;
        updatePlayButtons();
    });

    // Atualizar UI
    updateNowPlaying(titulo, autor, imageUrl);
    updateBottomPlayer(titulo, autor, imageUrl);
    
    // Mostrar players
    nowPlaying.classList.remove('hidden');
    bottomPlayer.classList.remove('hidden');

    // Reproduzir
    currentAudio.play().catch(err => {
        console.error('Erro ao reproduzir:', err);
        alert('Erro ao reproduzir música');
    });
}

// Atualizar seção "Tocando Agora"
function updateNowPlaying(titulo, autor, imageUrl) {
    nowPlayingTitle.textContent = titulo;
    nowPlayingArtist.textContent = autor;
    
    if (imageUrl) {
        nowPlayingImage.innerHTML = `<img src="${imageUrl}" alt="${titulo}">`;
    } else {
        nowPlayingImage.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px;">🎵</div>';
    }
}

// Atualizar player inferior
function updateBottomPlayer(titulo, autor, imageUrl) {
    playerTrackTitle.textContent = titulo;
    playerTrackArtist.textContent = autor;
    
    if (imageUrl) {
        playerTrackImage.innerHTML = `<img src="${imageUrl}" alt="${titulo}">`;
    } else {
        playerTrackImage.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px;">🎵</div>';
    }
}

// Atualizar botões de play/pause
function updatePlayButtons() {
    const icon = isPlaying ? '⏸' : '▶';
    if (playPauseBtn) playPauseBtn.textContent = icon;
    if (playerPlayPauseBtn) playerPlayPauseBtn.textContent = icon;
}

// Toggle play/pause
function togglePlayPause() {
    if (!currentAudio) return;
    
    if (isPlaying) {
        currentAudio.pause();
    } else {
        currentAudio.play();
    }
}

// Formatar tempo
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Atualizar progresso
function updateProgress() {
    if (!currentAudio) return;
    
    const current = currentAudio.currentTime;
    const duration = currentAudio.duration || 0;
    
    const currentTimeEl = document.getElementById('playerCurrentTime');
    const progressFill = document.getElementById('playerProgressFill');
    
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    
    if (duration > 0 && progressFill) {
        const percent = (current / duration) * 100;
        progressFill.style.width = percent + '%';
    }
}

// Verificar se há música tocando (da página de exploração)
function checkForPlayingMusic() {
    // Verificar se há música no localStorage da página de exploração
    const playingMusica = sessionStorage.getItem('playingMusica');
    if (playingMusica) {
        try {
            const musica = JSON.parse(playingMusica);
            playMusica(musica._id, musica.titulo, musica.autor, musica.imageUrl || '');
        } catch (e) {
            console.error('Erro ao carregar música do sessionStorage:', e);
        }
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Busca
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.location.href = `/explorar.html?q=${encodeURIComponent(searchInput.value)}`;
        }
    });

    // Botões de play/pause
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (playerPlayPauseBtn) playerPlayPauseBtn.addEventListener('click', togglePlayPause);

    // Barra de progresso
    const progressBar = document.getElementById('playerProgressBar');
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            if (!currentAudio) return;
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            currentAudio.currentTime = percent * currentAudio.duration;
        });
    }

    // Volume
    const volumeSlider = document.getElementById('playerVolumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            if (currentAudio) {
                currentAudio.volume = e.target.value / 100;
            }
        });
    }

    // Atualizar progresso a cada segundo
    setInterval(updateProgress, 1000);

    // Logout
    userAvatar.addEventListener('click', () => {
        if (confirm('Deseja sair?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/index.html';
        }
    });
}

// Tocar primeira música dos favoritos
async function playFavoritos() {
    try {
        const response = await fetch(`${API_URL}/favoritos/meus?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                const favorito = data.data[0];
                // O musicaId já vem populado com os dados da música
                const musica = favorito.musicaId || favorito;
                
                if (musica && musica._id) {
                    const imageUrl = musica.capa?.url || '';
                    const musicaId = musica._id || musica;
                    playMusica(musicaId, musica.titulo || 'Música desconhecida', musica.autor || 'Artista desconhecido', imageUrl);
                } else {
                    alert('Nenhuma música favoritada encontrada');
                }
            } else {
                alert('Você ainda não tem músicas favoritadas');
            }
        } else {
            console.error('Erro ao carregar favoritos:', response.status);
            alert('Erro ao carregar músicas favoritadas');
        }
    } catch (error) {
        console.error('Erro ao tocar favoritos:', error);
        alert('Erro ao carregar músicas favoritadas');
    }
}

// Tocar primeira música de uma playlist
async function playPlaylist(playlistId) {
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                const playlist = data.data;
                const musicas = playlist.musicas || [];
                
                if (musicas.length > 0) {
                    // Pegar a primeira música da playlist
                    const primeiraMusicaItem = musicas[0];
                    
                    // O campo musicaId já vem populado com os dados da música
                    const musica = primeiraMusicaItem.musicaId || primeiraMusicaItem;
                    
                    if (musica && musica._id) {
                        const musicaId = musica._id || musica;
                        const imageUrl = musica.capa?.url || '';
                        playMusica(musicaId, musica.titulo || 'Música desconhecida', musica.autor || 'Artista desconhecido', imageUrl);
                    } else {
                        // Se não veio populado, buscar os detalhes
                        const musicaId = typeof primeiraMusicaItem === 'string' 
                            ? primeiraMusicaItem 
                            : primeiraMusicaItem.musicaId || primeiraMusicaItem._id;
                        
                        if (musicaId) {
                            const musicaResponse = await fetch(`${API_URL}/musicas/${musicaId}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            
                            if (musicaResponse.ok) {
                                const musicaData = await musicaResponse.json();
                                if (musicaData.success && musicaData.data) {
                                    const musica = musicaData.data;
                                    const imageUrl = musica.capa?.url || '';
                                    playMusica(musica._id, musica.titulo, musica.autor, imageUrl);
                                } else {
                                    alert('Erro ao carregar música da playlist');
                                }
                            } else {
                                alert('Erro ao carregar música da playlist');
                            }
                        } else {
                            alert('Erro ao identificar música da playlist');
                        }
                    }
                } else {
                    alert('Esta playlist está vazia');
                }
            } else {
                alert('Erro ao carregar playlist');
            }
        } else {
            console.error('Erro ao carregar playlist:', response.status);
            alert('Erro ao carregar playlist');
        }
    } catch (error) {
        console.error('Erro ao tocar playlist:', error);
        alert('Erro ao carregar playlist');
    }
}

// Exportar funções globais
window.playMusica = playMusica;
window.togglePlayPause = togglePlayPause;
window.playFavoritos = playFavoritos;
window.playPlaylist = playPlaylist;
