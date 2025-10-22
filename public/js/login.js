// Configuração da API
const API_URL = 'http://localhost:3000/api/v1';

// Elementos do DOM
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const btnSubmit = loginForm.querySelector('button[type="submit"]');

// Função para mostrar erro
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Esconder após 5 segundos
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Função para limpar erro
function clearError() {
    errorMessage.style.display = 'none';
}

// Event listener do formulário
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    // Dados do formulário
    const formData = {
        emailOrUsername: document.getElementById('emailOrUsername').value.trim(),
        senha: document.getElementById('senha').value
    };

    // Validação básica
    if (!formData.emailOrUsername || !formData.senha) {
        showError('Por favor, preencha todos os campos');
        return;
    }

    // Loading state
    btnSubmit.disabled = true;
    btnSubmit.classList.add('loading');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Entrando...';

    try {
        // Fazer requisição para a API
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Salvar token no localStorage
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));

            // Redirecionar para a home
            window.location.href = '/home.html';
        } else {
            // Mostrar erro
            showError(data.message || 'Erro ao fazer login. Tente novamente.');
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        showError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
        // Remover loading state
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('loading');
        btnSubmit.textContent = originalText;
    }
});

// Verificar se usuário já está logado
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    if (token) {
        // Verificar se o token é válido
        fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token válido, redirecionar para home
                window.location.href = '/home.html';
            } else {
                // Token inválido, limpar localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(error => {
            console.error('Erro ao verificar token:', error);
        });
    }
});

// Função para lembrar usuário
const rememberMeCheckbox = document.getElementById('rememberMe');
const emailOrUsernameInput = document.getElementById('emailOrUsername');

// Carregar email salvo se existir
window.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        emailOrUsernameInput.value = savedEmail;
        rememberMeCheckbox.checked = true;
    }
});

// Salvar/remover email quando submeter form
loginForm.addEventListener('submit', () => {
    if (rememberMeCheckbox.checked) {
        localStorage.setItem('rememberedEmail', emailOrUsernameInput.value);
    } else {
        localStorage.removeItem('rememberedEmail');
    }
});

