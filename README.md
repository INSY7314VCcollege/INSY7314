# Secure International Payments Portal

A comprehensive, bank-grade secure international payments portal built with React and Node.js, demonstrating exceptional security practices and DevSecOps awareness.

## 🏦 Project Overview

This project is a Portfolio of Evidence assignment focusing on developing a secure customer and employee portal for international banking payments. The system allows customers to register, log in, and make international payments securely, while bank employees can verify, approve, and forward transactions to SWIFT.

## ✨ Features

### Customer Portal
- **Secure Registration**: Full name, ID number, account number, and password with strong validation
- **Multi-Factor Authentication**: Username, account number, and password login
- **International Payments**: Amount entry with currency selection (USD, EUR, GBP, ZAR)
- **Transaction Management**: View payment history, status tracking, and transaction details
- **Profile Management**: Update personal information and security settings
- **Real-time Security Monitoring**: Connection status, password strength, and security recommendations

### Employee Portal (Task 3)
- **Employee Authentication**: Secure login with employee ID, username, and password
- **Transaction Verification**: View and verify pending payment transactions
- **Transaction Management**: Approve, reject, or forward transactions to SWIFT
- **Dashboard Analytics**: View transaction statistics and status overview
- **Secure Access Control**: Role-based access with employee-specific authentication

### Security Features
- **Password Security**: Argon2 hashing with unique salts, strong password policies
- **Input Whitelisting**: Strict RegEx validation for all user inputs
- **SSL/TLS Security**: HTTPS enforcement with HSTS headers
- **Attack Protection**: XSS, CSRF, SQL injection, and brute force protection
- **DevSecOps Pipeline**: Automated security scanning and testing

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Query** for data fetching
- **React Hook Form** for form management
- **Lucide React** for icons

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Argon2** for password hashing
- **Helmet.js** for security headers
- **Rate limiting** and brute force protection

### Security Tools
- **SonarQube** for code quality analysis
- **MobSF** for mobile/web security testing
- **Scout Suite** for cloud security assessment
- **CircleCI** for continuous integration
- **ESLint** with security rules

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- MongoDB 6+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd secure-international-payments-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection and JWT secret
   ```

4. **Set up the database**
   ```bash
   # Start MongoDB service (Windows)
   net start MongoDB
   
   # Or on Linux/Mac
   sudo systemctl start mongod
   
   # Verify connection
   mongosh --eval "db.runCommand('ping')"
   ```

5. **Create demo employee (optional)**
   ```bash
   node scripts/create-demo-employee.js
   ```
   
   Demo credentials:
   - Username: `jsmith`
   - Employee ID: `EMP001`
   - Password: `Demo123!@#`

6. **Start the development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Customer Portal**: http://localhost:3000
- **Employee Portal**: http://localhost:3000/employee/login

## 🔐 Security Implementation

### Password Security
- **Argon2id** hashing algorithm with configurable parameters
- **Unique salt** per user password
- **Strong password policies**: 8+ characters, uppercase, lowercase, numbers, special characters
- **Password strength indicator** with real-time feedback
- **Password expiration** and change tracking

### Input Whitelisting
- **Strict RegEx validation** for all inputs:
  - Names: `/^[A-Za-z\s]{3,50}$/`
  - ID Numbers: `/^\d{13}$/`
  - Account Numbers: `/^\d{10,12}$/`
  - SWIFT Codes: `/^[A-Z]{6}[A-Z0-9]{2,5}$/`
  - Email: RFC-compliant validation
  - Phone: International format validation
- **XSS protection** with input sanitization
- **SQL injection prevention** with parameterized queries

### Data in Transit Security
- **HTTPS enforcement** in production
- **HSTS headers** for strict transport security
- **SSL/TLS 1.2+** with strong cipher suites
- **Certificate validation** and pinning
- **Secure cookie flags**: HttpOnly, SameSite, Secure

### Attack Protection
- **XSS Protection**: Content Security Policy, input sanitization
- **CSRF Protection**: CSRF tokens on all forms
- **SQL Injection**: Parameterized queries, input validation
- **Brute Force**: Rate limiting, account lockout
- **Session Security**: Secure session management, timeout
- **Headers Security**: Helmet.js configuration

## 🔄 DevSecOps Pipeline

### Continuous Integration
- **CircleCI** configuration with security scanning
- **Automated testing** on every commit
- **Security audit** with npm audit
- **Dependency vulnerability** scanning
- **Code quality** checks with ESLint

### Security Scanning
- **SonarQube** for static code analysis
- **MobSF** for mobile/web security testing
- **Scout Suite** for cloud security assessment
- **Snyk** for dependency vulnerability scanning
- **Detect-secrets** for hardcoded secrets detection

### Deployment
- **Staging environment** with security validation
- **Production deployment** with security gates
- **Automated security testing** in pipeline
- **Rollback capabilities** for security issues

## 📁 Project Structure

```
secure-international-payments-portal/
├── public/                 # Static assets
├── src/                   # React frontend
│   ├── components/        # Reusable components
│   ├── contexts/          # React contexts
│   ├── pages/            # Page components
│   ├── services/         # API services
│   ├── types/            # TypeScript types
│   └── App.tsx           # Main app component
├── server/               # Node.js backend
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── migrations/       # Database migrations
│   └── index.js          # Server entry point
├── .circleci/            # CI/CD configuration
├── scripts/              # Utility scripts
├── certs/                # SSL certificates
└── logs/                 # Application logs
```

## 🧪 Testing

### Running Tests
```bash
# Frontend tests
npm test

# Backend tests
npm run test:server

# Security tests
npm run security-scan

# Code quality
npm run lint
```

### Test Coverage
- **Unit tests** for components and utilities
- **Integration tests** for API endpoints
- **Security tests** for authentication and authorization
- **E2E tests** for critical user flows

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Payment Endpoints
- `POST /api/payments/make-payment` - Create payment
- `GET /api/payments/transactions` - Get transactions
- `GET /api/payments/transactions/:id` - Get transaction details
- `PUT /api/payments/transactions/:id/cancel` - Cancel transaction
- `GET /api/payments/currencies` - Get supported currencies
- `GET /api/payments/limits` - Get payment limits and fees

### Employee Endpoints
- `POST /api/employees/login` - Employee login
- `POST /api/employees/logout` - Employee logout
- `POST /api/employees/refresh` - Refresh employee token
- `GET /api/employees/me` - Get current employee
- `GET /api/employees/transactions` - Get transactions for verification
- `GET /api/employees/transactions/:id` - Get transaction details
- `POST /api/employees/transactions/:id/verify` - Verify transaction
- `POST /api/employees/transactions/:id/reject` - Reject transaction
- `POST /api/employees/transactions/:id/submit-swift` - Submit to SWIFT
- `GET /api/employees/statistics` - Get transaction statistics

### User Endpoints
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/security-status` - Get security status
- `POST /api/users/enable-2fa` - Enable 2FA
- `POST /api/users/verify-2fa` - Verify 2FA

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
HTTPS_PORT=3443

# Database Configuration (MongoDB)
MONGODB_URI=mongodb://localhost:27017/secure_payments_portal
DB_HOST=localhost
DB_PORT=27017
DB_NAME=secure_payments_portal

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret
ARGON2_MEMORY=65536
ARGON2_PARALLELISM=2
ARGON2_TIME=3

# SSL Configuration
SSL_KEY_PATH=./certs/private-key.pem
SSL_CERT_PATH=./certs/certificate.pem
```

## 🚀 Deployment

### Production Deployment
1. **Set up production environment**
2. **Configure SSL certificates**
3. **Set up database with proper security**
4. **Configure environment variables**
5. **Run database migrations**
6. **Start the application**

### Docker Deployment
```bash
# Build Docker image
docker build -t secure-payments-portal .

# Run with Docker Compose
docker-compose up -d
```

## 📈 Monitoring and Logging

### Security Monitoring
- **Audit logging** for all security events
- **Failed login attempts** tracking
- **Suspicious activity** detection
- **Real-time security alerts**

### Application Monitoring
- **Health check** endpoints
- **Performance metrics** collection
- **Error tracking** and reporting
- **User activity** monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and security scans
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

  # Test commit to trigger CircleCI


## 🔗 References

- [OWASP Security Guidelines](https://owasp.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [PCI DSS Standards](https://www.pcisecuritystandards.org/)
- [React Security Best Practices](https://reactjs.org/docs/security.html)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

---


