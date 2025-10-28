/**
 * Script para página Home (após login)
 */

const API_URL = 'http://localhost:3000/api/v1';
const token = localStorage.getItem('token');

// Verificar se está logado
if (!token) {
    window.location.href = '/index.html';
}

// Carregar dados do usuário
async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.data.user;

            document.getElementById('userInfo').innerHTML = `
                <h2>Informações da Conta</h2>
                <p><strong>Nome de Usuário:</strong> ${user.nomeUsuario}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Nome:</strong> ${user.fullName || 'Não informado'}</p>
                <p><strong>Plano:</strong> ${user.account.subscription.toUpperCase()}</p>
                <p><strong>Membro desde:</strong> ${new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
            `;
        } else {
            // Token inválido
            console.log('Token inválido ou expirado');
            logout();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Função de Logout
function logout() {
    console.log('Fazendo logout...');
    
    // Limpar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirecionar para página de login
    window.location.href = '/index.html';
}

// Adicionar event listener para o botão de logout
document.addEventListener('DOMContentLoaded', function() {
    // Carregar dados do usuário
    loadUserData();
    
    // Adicionar event listener no botão de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
});

// Exportar funções para uso global
window.logout = logout;
window.loadUserData = loadUserData;

