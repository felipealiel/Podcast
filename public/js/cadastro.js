// Configuração da API
const API_URL = 'http://localhost:3000/api/v1';

// Elementos do DOM
const registerForm = document.getElementById('registerForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const btnSubmit = registerForm.querySelector('button[type="submit"]');

// Função para mostrar erro
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    // Esconder após 5 segundos
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Função para mostrar sucesso
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// Função para limpar mensagens
function clearMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Event listener do formulário
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    // Dados do formulário
    const formData = {
        email: document.getElementById('email').value.trim(),
        nomeUsuario: document.getElementById('nomeUsuario').value.trim(),
        senha: document.getElementById('senha').value,
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim()
    };

    // Validação básica
    if (!formData.email || !formData.nomeUsuario || !formData.senha) {
        showError('Por favor, preencha todos os campos obrigatórios');
        return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showError('Por favor, insira um email válido');
        return;
    }

    // Validar nome de usuário
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(formData.nomeUsuario)) {
        showError('Nome de usuário deve ter 3-30 caracteres (letras, números e underscore)');
        return;
    }

    // Validar senha
    if (formData.senha.length < 6) {
        showError('Senha deve ter pelo menos 6 caracteres');
        return;
    }

    // Verificar termos
    const termsCheckbox = document.getElementById('terms');
    if (!termsCheckbox.checked) {
        showError('Você deve concordar com os Termos e Condições');
        return;
    }

    // Loading state
    btnSubmit.disabled = true;
    btnSubmit.classList.add('loading');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Cadastrando...';

    try {
        // Fazer requisição para a API
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Mostrar mensagem de sucesso
            showSuccess('Conta criada com sucesso! Redirecionando...');

            // Salvar token no localStorage
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));

            // Redirecionar para a home após 2 segundos
            setTimeout(() => {
                window.location.href = '/home.html';
            }, 2000);
        } else {
            // Mostrar erro
            if (data.errors && Array.isArray(data.errors)) {
                // Erros de validação
                const errorMessages = data.errors.map(err => err.message).join(', ');
                showError(errorMessages);
            } else {
                showError(data.message || 'Erro ao criar conta. Tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro ao cadastrar:', error);
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

// Validação em tempo real do nome de usuário
const nomeUsuarioInput = document.getElementById('nomeUsuario');
nomeUsuarioInput.addEventListener('input', (e) => {
    const value = e.target.value;
    const usernameRegex = /^[a-zA-Z0-9_]*$/;
    
    if (!usernameRegex.test(value)) {
        e.target.value = value.replace(/[^a-zA-Z0-9_]/g, '');
    }
});

// Mostrar força da senha
const senhaInput = document.getElementById('senha');
senhaInput.addEventListener('input', (e) => {
    const senha = e.target.value;
    const small = e.target.nextElementSibling;
    
    if (senha.length === 0) {
        small.textContent = 'Use pelo menos 6 caracteres';
        small.style.color = 'var(--spotify-light-gray)';
    } else if (senha.length < 6) {
        small.textContent = `Muito curta (${senha.length}/6)`;
        small.style.color = 'var(--error-red)';
    } else if (senha.length < 8) {
        small.textContent = 'Senha fraca';
        small.style.color = '#FFA500';
    } else {
        small.textContent = 'Senha forte!';
        small.style.color = 'var(--success-green)';
    }
});

