# 🔒 ALX Polly: Secure Polling Application

A full-stack polling application built with Next.js, TypeScript, and Supabase, featuring comprehensive security measures and educational vulnerability fixes.

## 🎯 About This Project

ALX Polly serves as both a **production-ready polling application** and a **security learning platform**. Originally built with intentional vulnerabilities for educational purposes, it has been completely secured with enterprise-grade security measures.

**Key Features:**
- 🔐 **Secure Authentication** with strong password requirements
- 🛡️ **Role-Based Access Control** for admin operations  
- ✅ **Input Validation & XSS Protection**
- 🚫 **Rate Limiting & CSRF Protection**
- 📊 **Comprehensive Audit Logging**
- 🗄️ **Database Security** with Row Level Security (RLS)

## 🏗️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend & Database**: [Supabase](https://supabase.io/)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: Supabase Auth with custom security enhancements

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v20.x or higher)
- npm or yarn
- Supabase account

### 1. Clone & Install
```bash
git clone <repository-url>
cd alx-polly
npm install
```

### 2. Environment Setup
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup
Run the complete setup script in your Supabase SQL editor:
```bash
# Copy contents of database-setup.sql to Supabase SQL Editor and execute
```

Create your first admin user:
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'your-admin-email@example.com';
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 🔒 Security Features & Fixes

This application has been secured against **20 critical vulnerabilities**. Here's what was fixed:

### 🚨 Critical Security Fixes (5)

#### 1. **Admin Panel Access Control** ✅
- **Issue**: Any authenticated user could access admin panel and delete all polls
- **Fix**: Role-based access control with database verification
- **Implementation**: 
  - `user_roles` table with proper RLS policies
  - Server-side admin verification on every request
  - Comprehensive authorization checks

#### 2. **Poll Ownership Authorization** ✅
- **Issue**: Users could delete any poll regardless of ownership
- **Fix**: Ownership verification before any poll operation
- **Implementation**:
  - User ID matching with admin override capability
  - Database-level ownership checks
  - Proper error handling for unauthorized access

#### 3. **Vote Index Validation** ✅
- **Issue**: Invalid vote indices could corrupt database
- **Fix**: Comprehensive bounds checking and validation
- **Implementation**:
  - Poll options validation against database
  - Input type and range verification
  - Database triggers for additional protection

#### 4. **Unlimited Vote Spam** ✅
- **Issue**: No duplicate vote prevention - unlimited voting possible
- **Fix**: Vote limiting and duplicate detection
- **Implementation**:
  - One vote per user per poll constraint
  - Rate limiting (5 votes per minute per user)
  - Authentication required for voting

#### 5. **Input Sanitization & XSS Protection** ✅
- **Issue**: User input not sanitized - stored XSS attacks possible
- **Fix**: Comprehensive input validation and sanitization
- **Implementation**:
  - HTML tag removal and character encoding
  - Content length limits and validation
  - Blocked dangerous patterns (script tags, javascript:, data: URIs)

### 🔴 High Priority Fixes (4)

#### 6. **Password Security** ✅
- **Strong password policy**: 8+ characters, mixed case, numbers, symbols
- **Blocked common passwords**: password, 123456, etc.
- **Real-time validation** with visual feedback

#### 7. **Edit Poll Authorization** ✅
- **Server-side ownership verification** for edit access
- **Unauthorized user redirection** with proper error handling
- **Privacy protection** for poll content

#### 8. **Information Disclosure Prevention** ✅
- **Limited UUID exposure** (truncated displays)
- **Sanitized error messages** without system details
- **Protected internal system information**

#### 9. **Error Message Security** ✅
- **Generic user-facing errors** to prevent information leakage
- **Server-side detailed logging** for debugging
- **Prevention of user enumeration** attacks

### 🟡 Medium Priority Fixes (10)

#### Authentication & Session Management
- ✅ **Proper logout functionality** with session clearing
- ✅ **Enhanced client-side auth** with better UX
- ✅ **Session timeout handling** and state management

#### Rate Limiting & Protection
- ✅ **IP-based rate limiting** (100 requests per 5 minutes)
- ✅ **CSRF protection** with origin validation
- ✅ **Security headers** (X-Frame-Options, X-XSS-Protection, etc.)

#### Data Protection & Monitoring
- ✅ **Removed sensitive console logging**
- ✅ **Race condition fixes** in delete operations
- ✅ **Comprehensive audit logging** for security events

#### Input Validation Enhancements
- ✅ **Content length limits**: Questions (500 chars), Options (200 chars)
- ✅ **Format validation**: Email, UUID, numeric bounds
- ✅ **Unique option requirements** and duplicate prevention

---

## 🛡️ Security Implementation Details

### Password Requirements
```typescript
// Strong password policy enforced
- Minimum 8 characters
- At least one lowercase letter (a-z)
- At least one uppercase letter (A-Z)  
- At least one number (0-9)
- At least one special character (!@#$%^&*)
- Blocked common passwords
```

### Database Security
```sql
-- Row Level Security enabled on all tables
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS policy
CREATE POLICY "Users can only delete their own polls OR admins can delete any"
ON polls FOR DELETE USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);
```

### Rate Limiting
```typescript
// Implemented in middleware
- General requests: 100 per 5 minutes per IP
- Vote submissions: 5 per minute per user
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### Input Sanitization
```typescript
function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, (char) => {
      const entities = {
        '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#x27;', '&': '&amp;'
      };
      return entities[char] || char;
    })
    .trim();
}
```

---

## 📊 Database Schema

### Core Tables
```sql
-- Users (managed by Supabase Auth)
auth.users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE,
    created_at TIMESTAMP
)

-- User Roles for Access Control
user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    role VARCHAR(50) DEFAULT 'user',
    granted_by UUID,
    granted_at TIMESTAMP DEFAULT NOW()
)

-- Polls
polls (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    question TEXT CHECK (length(question) <= 500),
    options JSONB CHECK (jsonb_array_length(options) >= 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)

-- Votes with Constraints
votes (
    id UUID PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    option_index INTEGER CHECK (option_index >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(poll_id, user_id) -- Prevent duplicate votes
)

-- Audit Trail
audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
)
```

---

## 🔧 API Endpoints & Security

### Authentication Actions
```typescript
// Secure auth functions
- login(credentials) // With rate limiting and error handling
- register(userData) // With password validation
- logout() // Proper session clearing
- requireAuth() // Server-side auth verification
- requireAdmin() // Admin-only access control
```

### Poll Actions  
```typescript
// Protected poll operations
- createPoll(formData) // Input validation & sanitization
- getUserPolls() // User's own polls only
- getPollById(id) // Public access with validation
- updatePoll(id, data) // Ownership verification required
- deletePoll(id) // Ownership OR admin required
- submitVote(pollId, optionIndex) // Validation & duplicate prevention
```

### Admin Actions
```typescript
// Admin-only functions
- isAdmin(userId) // Role verification
- getAllPolls() // Admin panel access
- auditLogs() // Security monitoring
```

---

## 🚀 Production Deployment

### Security Checklist
- [ ] Database setup script executed
- [ ] First admin user created
- [ ] Environment variables configured
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Rate limiting tested
- [ ] Audit logging verified
- [ ] Admin access tested
- [ ] Input validation verified
- [ ] Password policy enforced

### Environment Configuration
```env
# Production environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://connection-string
```

### Monitoring Setup
```typescript
// Monitor these security events
- Failed login attempts (> 5 per hour)
- Admin panel access by new users
- Rate limit violations
- Database constraint violations
- Suspicious voting patterns
```

---

## 📈 Security Metrics

### Before Security Fixes
- **Critical Vulnerabilities**: 5 ❌
- **High Severity**: 4 ❌
- **Medium Severity**: 10 ❌  
- **Low Severity**: 1 ❌
- **Total Vulnerabilities**: 20 ❌

### After Security Fixes
- **Critical Vulnerabilities**: 0 ✅
- **High Severity**: 0 ✅
- **Medium Severity**: 0 ✅
- **Low Severity**: 0 ✅
- **Total Vulnerabilities**: 0 ✅

### Security Improvements Implemented
- ✅ **100% vulnerability remediation**
- ✅ **Enterprise-grade access control**
- ✅ **Comprehensive input validation**
- ✅ **Database security with RLS**
- ✅ **Audit trail for monitoring**
- ✅ **Rate limiting and CSRF protection**
- ✅ **Strong authentication requirements**
- ✅ **Error handling without information disclosure**

---

## 🔍 Security Testing

### Manual Security Tests
```bash
# Test admin access control
1. Register non-admin user
2. Try accessing /admin
3. Verify access denied

# Test poll ownership
1. Create poll with User A
2. Login as User B  
3. Try deleting User A's poll
4. Verify permission denied

# Test input validation
1. Create poll with <script>alert('xss')</script>
2. Verify script tags are stripped
3. Check no XSS execution

# Test rate limiting
1. Make 100+ requests quickly
2. Verify 429 rate limit response

# Test password policy
1. Try weak passwords (123, abc)
2. Verify rejection with requirements shown
```

### Automated Security Scanning
```bash
npm audit                    # Check for vulnerable dependencies
npm run test:security       # Custom security tests
npx audit-ci --moderate     # CI security checks
```

---

## 🚨 Attack Scenarios - Now Prevented

### ❌ Before: Complete System Compromise
1. User registers → 2. Navigates to `/admin` → 3. Deletes all polls → 4. **System compromised**

### ✅ After: Proper Authorization
1. User registers → 2. Navigates to `/admin` → 3. **Access denied - Admin required** → 4. **Attack prevented**

### ❌ Before: Poll Manipulation Attack  
1. Attacker finds poll ID → 2. Calls `deletePoll(id)` → 3. Any poll deleted → 4. **Data loss**

### ✅ After: Ownership Verification
1. Attacker finds poll ID → 2. Calls `deletePoll(id)` → 3. **Ownership check fails** → 4. **Attack prevented**

### ❌ Before: Vote Manipulation
1. Script calls `submitVote()` unlimited times → 2. Results manipulated → 3. **Poll integrity lost**

### ✅ After: Vote Protection System
1. Script attempts vote spam → 2. **Duplicate detection** → 3. **Rate limit triggered** → 4. **Attack prevented**

---

## 📚 Educational Value

This project demonstrates:

### Common Web Vulnerabilities
- **Broken Access Control** (OWASP #1)
- **Cryptographic Failures** (OWASP #2)  
- **Injection Attacks** (OWASP #3)
- **Insecure Design** (OWASP #4)
- **Security Misconfiguration** (OWASP #5)
- **Cross-Site Scripting (XSS)** (OWASP #7)

### Security Best Practices  
- **Input validation and sanitization**
- **Strong authentication and authorization**
- **Database security with RLS**
- **Rate limiting and DoS protection**
- **Secure session management**
- **Comprehensive audit logging**
- **Error handling without information disclosure**

---

## 🛠️ Development

### Local Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server  
npm run lint         # Check code quality
npm run tsc          # TypeScript compilation check
```

### Code Structure
```
alx-polly/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Protected dashboard routes
│   │   ├── admin/          # Admin-only pages
│   │   ├── polls/          # Poll management
│   │   └── create/         # Poll creation
│   ├── lib/
│   │   ├── actions/        # Server actions with security
│   │   ├── context/        # Auth context
│   │   └── types/          # TypeScript definitions
│   └── components/         # UI components
├── lib/supabase/           # Database client configuration
├── components/ui/          # Reusable UI components
└── database-setup.sql      # Complete database setup
```

---

## 🤝 Contributing

### Security-First Development
1. **Never commit sensitive data** (API keys, passwords)
2. **Validate all user input** before processing
3. **Test authorization** for every protected action
4. **Follow secure coding practices** outlined in this README
5. **Add security tests** for new features

### Pull Request Requirements
- [ ] Security review completed
- [ ] Input validation tests added
- [ ] Authorization checks verified
- [ ] No sensitive data in commits
- [ ] Documentation updated

---

## 📞 Security Contact

### Reporting Security Issues
- **Email**: security@yourcompany.com  
- **Subject**: "SECURITY: ALX Polly Vulnerability Report"
- **Response time**: 24 hours acknowledgment, 48 hours assessment

### What to Include
- Detailed vulnerability description
- Steps to reproduce the issue  
- Potential impact assessment
- Suggested fix (if known)

---

## 📖 Additional Resources

### Security Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)

### Security Tools
- [OWASP ZAP](https://owasp.org/www-project-zap/) - Web security scanner
- [Burp Suite](https://portswigger.net/burp) - Vulnerability assessment
- [SQLMap](https://sqlmap.org/) - SQL injection testing

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 Project Status

**Security Status**: 🔒 **SECURE** ✅  
**Vulnerabilities**: **0/20** ✅  
**Production Ready**: **YES** ✅  
**Educational Value**: **HIGH** ✅

---

*ALX Polly - From Vulnerable to Bulletproof: A complete security transformation demonstrating enterprise-grade security implementation in a modern web application.*

**Last Updated**: December 2024 | **Version**: 2.0 Security Release