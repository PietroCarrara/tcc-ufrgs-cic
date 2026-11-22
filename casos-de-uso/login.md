**Autenticação**

_Garantias de sucesso:_ O restante da sessão do usuário estará autenticada, como professor ou como aluno.

Cenário Principal de Sucesso:

1. O usuário abre o cliente e clica em um dos botões de autenticação (módulos podem adicionar outras possibilidades de login: login via rede social, credenciais acadêmicas, ...)
2. O sistema o leva para a tela de autenticação do módulo selecionado
3. O usuário preenche seus dados de login
4. O usuário é redirecionado para a tela inicial do sistema

Extensões:

- 3a: Credenciais inválidas
    1. Caso o usuário insira credenciais inválidas, o comportamento do sistema não é especificado, ficando a critério dos módulos de autenticação
