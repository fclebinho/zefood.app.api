# ZeFood API Backend

API backend para a plataforma SaaS de delivery multi-restaurante ZeFood.

## Tecnologias

- **NestJS** - Framework Node.js progressivo
- **TypeScript** - Superset JavaScript tipado
- **Prisma** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação e autorização
- **Socket.io** - Comunicação em tempo real
- **Docker** - Containerização
- **AWS S3** - Armazenamento de arquivos
- **Stripe & MercadoPago** - Processamento de pagamentos

## Funcionalidades

- **Autenticação e Autorização** - Sistema completo com JWT e refresh tokens
- **Gestão de Restaurantes** - CRUD completo, cardápios, categorias e produtos
- **Sistema de Pedidos** - Criação, acompanhamento e gestão de pedidos
- **Pagamentos Integrados** - Suporte a Stripe e MercadoPago
- **Rastreamento em Tempo Real** - WebSocket para acompanhamento de entregas
- **Gestão de Entregadores** - Sistema completo para motoristas
- **Upload de Imagens** - Integração com AWS S3
- **Notificações** - Sistema de notificações em tempo real
- **Painel Administrativo** - APIs para gestão da plataforma

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- npm ou yarn
- Docker (opcional)

## Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd backend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/foodapp?schema=public"

# JWT
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-key-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV=development
```

### Banco de Dados

```bash
# Gerar Prisma Client
npm run db:generate

# Executar migrations
npm run db:migrate

# Popular banco com dados iniciais (opcional)
npm run db:seed

# Abrir Prisma Studio para visualizar dados
npm run db:studio
```

## Executando a Aplicação

### Desenvolvimento

```bash
# Modo watch (hot reload)
npm run dev

# Modo debug
npm run start:debug
```

### Produção

```bash
# Build
npm run build

# Executar em produção
npm run start:prod
```

### Docker

```bash
# Build da imagem
docker build -t zefood-api .

# Executar container
docker run -p 3001:3001 --env-file .env zefood-api
```

## Estrutura do Projeto

```
src/
├── admin/          # Módulo administrativo
├── auth/           # Autenticação e autorização
├── drivers/        # Gestão de entregadores
├── orders/         # Sistema de pedidos
├── payments/       # Processamento de pagamentos
├── prisma/         # Configuração do Prisma
├── restaurants/    # Gestão de restaurantes
├── settings/       # Configurações da aplicação
├── tracking/       # Rastreamento em tempo real
├── upload/         # Upload de arquivos
├── users/          # Gestão de usuários
└── websocket/      # Comunicação em tempo real
```

## Módulos Principais

### Auth
Sistema de autenticação com JWT, refresh tokens e estratégias Passport.

### Restaurants
- CRUD de restaurantes
- Gestão de cardápios
- Categorias de produtos
- Produtos e variações
- Horários de funcionamento

### Orders
- Criação de pedidos
- Gestão de status
- Histórico de pedidos
- Cálculo de valores

### Payments
- Integração com Stripe
- Integração com MercadoPago
- Webhook handling
- Gestão de transações

### Tracking
- Rastreamento de entregadores
- Atualizações de localização em tempo real
- Status de entrega

### WebSocket
- Eventos em tempo real
- Notificações
- Chat entre usuários

## Versionamento e Deploy

Este projeto utiliza versionamento semântico automatizado com `standard-version`.

### Criar Nova Versão

```bash
# Versão patch (1.0.0 → 1.0.1) - bug fixes
npm run release:patch

# Versão minor (1.0.0 → 1.1.0) - novas features
npm run release:minor

# Versão major (1.0.0 → 2.0.0) - breaking changes
npm run release:major

# Automático baseado nos commits
npm run release
```

### Deploy

O deploy é automatizado via GitHub Actions quando uma tag é criada:

```bash
# 1. Criar versão (cria tag automaticamente)
npm run release

# 2. Enviar para o GitHub
git push --follow-tags

# 3. A pipeline será executada automaticamente
# - Build da imagem Docker
# - Push para Docker Hub com a versão da tag
```

### Conventional Commits

Use o padrão de commits para gerar changelogs automáticos:

```bash
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
style: formatação de código
refactor: refatoração de código
perf: melhoria de performance
test: adiciona testes
chore: tarefas gerais
```

## API Documentation

A API segue padrões RESTful. Principais endpoints:

### Authentication
- `POST /auth/register` - Registro de usuário
- `POST /auth/login` - Login
- `POST /auth/refresh` - Renovar token
- `POST /auth/logout` - Logout

### Restaurants
- `GET /restaurants` - Listar restaurantes
- `POST /restaurants` - Criar restaurante
- `GET /restaurants/:id` - Buscar restaurante
- `PATCH /restaurants/:id` - Atualizar restaurante
- `DELETE /restaurants/:id` - Remover restaurante

### Orders
- `GET /orders` - Listar pedidos
- `POST /orders` - Criar pedido
- `GET /orders/:id` - Buscar pedido
- `PATCH /orders/:id/status` - Atualizar status

### Payments
- `POST /payments/stripe/create-intent` - Criar intenção de pagamento
- `POST /payments/mercadopago/create` - Criar pagamento
- `POST /payments/webhooks/stripe` - Webhook Stripe
- `POST /payments/webhooks/mercadopago` - Webhook MercadoPago

## Roles e Permissões

O sistema possui diferentes níveis de acesso:

- **ADMIN** - Acesso total à plataforma
- **RESTAURANT** - Gestão do próprio restaurante
- **DRIVER** - Acesso a entregas
- **CUSTOMER** - Realização de pedidos

## Testes

```bash
# Testes unitários
npm test

# Testes e2e
npm run test:e2e

# Cobertura de testes
npm run test:cov
```

## Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feat/nova-feature`)
3. Commit suas mudanças usando Conventional Commits (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feat/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto é privado e proprietário.

## Suporte

Para dúvidas e suporte, entre em contato com a equipe de desenvolvimento.
