# Cashback & Rewards Service - Low Level Design

## 1. Service Overview

### 1.1 Service Responsibilities
- **Loyalty Program Management**: Create and manage different loyalty tiers and programs
- **Cashback Calculations**: Calculate cashback based on spending patterns and rules
- **Reward Point Tracking**: Track and manage reward points accumulation
- **Redemption Management**: Handle reward redemptions and validations
- **Promotional Campaigns**: Manage special offers and bonus rewards
- **Analytics & Reporting**: Generate insights on reward utilization

### 1.2 Service Configuration
- **Port**: 3009
- **Database**: PostgreSQL
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Authentication**: JWT Token validation
- **Caching**: Redis for frequently accessed data

## 2. Detailed Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        MOB[Mobile App]
        ADM[Admin Dashboard]
    end

    subgraph "API Gateway"
        GATE[GraphQL/REST Gateway]
    end

    subgraph "Cashback & Rewards Service - Port 3009"
        subgraph "API Layer"
            CTRL1[Rewards Controller]
            CTRL2[Cashback Controller]
            CTRL3[Loyalty Controller]
            CTRL4[Campaign Controller]
        end

        subgraph "Business Logic Layer"
            SVC1[Rewards Service]
            SVC2[Cashback Service]
            SVC3[Loyalty Service]
            SVC4[Campaign Service]
            SVC5[Analytics Service]
        end

        subgraph "Data Access Layer"
            REPO1[Rewards Repository]
            REPO2[Cashback Repository]
            REPO3[Loyalty Repository]
            REPO4[Campaign Repository]
        end

        subgraph "External Integration Layer"
            INT1[Wallet Service Client]
            INT2[Expense Service Client]
            INT3[Notification Service Client]
            INT4[User Service Client]
        end

        subgraph "Utility Layer"
            CALC[Calculation Engine]
            RULE[Rules Engine]
            VALID[Validation Engine]
            AUDIT[Audit Logger]
        end
    end

    subgraph "Data Storage"
        PG[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end

    subgraph "External Services"
        WALLET[Wallet Service]
        EXPENSE[Expense Service]
        NOTIFY[Notification Service]
        USER[User Service]
    end

    subgraph "Message Queue"
        MQ[RabbitMQ/Kafka]
    end

    WEB --> GATE
    MOB --> GATE
    ADM --> GATE
    
    GATE --> CTRL1
    GATE --> CTRL2
    GATE --> CTRL3
    GATE --> CTRL4

    CTRL1 --> SVC1
    CTRL2 --> SVC2
    CTRL3 --> SVC3
    CTRL4 --> SVC4

    SVC1 --> REPO1
    SVC2 --> REPO2
    SVC3 --> REPO3
    SVC4 --> REPO4
    SVC1 --> SVC5
    SVC2 --> SVC5

    SVC1 --> INT1
    SVC2 --> INT1
    SVC3 --> INT2
    SVC4 --> INT3
    SVC5 --> INT4

    SVC1 --> CALC
    SVC2 --> CALC
    SVC3 --> RULE
    SVC4 --> RULE
    SVC1 --> VALID
    SVC2 --> VALID

    REPO1 --> PG
    REPO2 --> PG
    REPO3 --> PG
    REPO4 --> PG

    SVC1 --> REDIS
    SVC2 --> REDIS
    SVC3 --> REDIS

    INT1 --> WALLET
    INT2 --> EXPENSE
    INT3 --> NOTIFY
    INT4 --> USER

    SVC1 --> MQ
    SVC2 --> MQ
    SVC3 --> MQ
    SVC4 --> MQ
```

## 3. Database Design

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    LOYALTY_PROGRAMS {
        uuid id PK
        string name
        string description
        string tier_type
        json benefits
        json requirements
        decimal min_spending
        decimal max_spending
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    USER_LOYALTY_STATUS {
        uuid id PK
        uuid user_id FK
        uuid program_id FK
        string current_tier
        decimal total_spending
        decimal tier_progress
        date tier_achieved_date
        date tier_expiry_date
        timestamp last_updated
    }

    REWARD_POINTS {
        uuid id PK
        uuid user_id FK
        decimal points_earned
        decimal points_available
        decimal points_redeemed
        decimal points_expired
        string source_type
        uuid source_id
        date expiry_date
        timestamp created_at
    }

    CASHBACK_TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        uuid transaction_id FK
        decimal transaction_amount
        decimal cashback_percentage
        decimal cashback_amount
        string cashback_type
        uuid campaign_id FK
        string status
        timestamp processed_at
        timestamp created_at
    }

    REWARD_REDEMPTIONS {
        uuid id PK
        uuid user_id FK
        decimal points_used
        string redemption_type
        json redemption_details
        decimal cash_value
        string status
        timestamp processed_at
        timestamp created_at
    }

    CAMPAIGNS {
        uuid id PK
        string name
        string description
        string campaign_type
        json rules
        json rewards
        date start_date
        date end_date
        decimal min_transaction
        decimal max_cashback
        boolean is_active
        timestamp created_at
    }

    USER_CAMPAIGNS {
        uuid id PK
        uuid user_id FK
        uuid campaign_id FK
        decimal total_earned
        integer usage_count
        date last_used
        timestamp enrolled_at
    }

    REWARD_HISTORY {
        uuid id PK
        uuid user_id FK
        string action_type
        decimal points_change
        decimal cashback_change
        string description
        json metadata
        timestamp created_at
    }

    LOYALTY_PROGRAMS ||--o{ USER_LOYALTY_STATUS : "has"
    USER_LOYALTY_STATUS }o--|| REWARD_POINTS : "earns"
    CASHBACK_TRANSACTIONS }o--|| CAMPAIGNS : "belongs_to"
    REWARD_REDEMPTIONS }o--|| REWARD_POINTS : "uses"
    CAMPAIGNS ||--o{ USER_CAMPAIGNS : "enrolled_in"
    USER_LOYALTY_STATUS ||--o{ REWARD_HISTORY : "generates"
```

### 3.2 Table Specifications

#### 3.2.1 LOYALTY_PROGRAMS
**Purpose**: Define different loyalty tiers and their benefits
- **Primary Key**: id (UUID)
- **Indexes**: name, tier_type, is_active
- **Partitioning**: None
- **Estimated Size**: 50-100 records

#### 3.2.2 USER_LOYALTY_STATUS
**Purpose**: Track user's current loyalty status and progress
- **Primary Key**: id (UUID)
- **Foreign Keys**: user_id, program_id
- **Indexes**: user_id, program_id, current_tier
- **Partitioning**: By user_id (hash)
- **Estimated Size**: 100K+ records

#### 3.2.3 REWARD_POINTS
**Purpose**: Track user's reward points balance and transactions
- **Primary Key**: id (UUID)
- **Foreign Keys**: user_id
- **Indexes**: user_id, source_type, expiry_date
- **Partitioning**: By user_id (hash)
- **Estimated Size**: 1M+ records

#### 3.2.4 CASHBACK_TRANSACTIONS
**Purpose**: Record all cashback calculations and processing
- **Primary Key**: id (UUID)
- **Foreign Keys**: user_id, transaction_id, campaign_id
- **Indexes**: user_id, transaction_id, status, processed_at
- **Partitioning**: By created_at (monthly)
- **Estimated Size**: 10M+ records

## 4. API Design

### 4.1 RESTful API Endpoints

#### 4.1.1 Rewards Management APIs

```
GET /api/v1/rewards/{userId}
├── Purpose: Get user's reward points summary
├── Authentication: JWT Required
├── Authorization: User, Manager, Admin
├── Rate Limit: 100 requests/minute
├── Response Format: JSON
└── Cache Duration: 5 minutes

POST /api/v1/rewards/redeem
├── Purpose: Redeem reward points
├── Authentication: JWT Required
├── Authorization: User, Manager
├── Rate Limit: 10 requests/minute
├── Validation: Points balance, redemption rules
└── Response Format: JSON

GET /api/v1/rewards/{userId}/history
├── Purpose: Get reward points transaction history
├── Authentication: JWT Required
├── Authorization: User, Manager, Admin
├── Pagination: Cursor-based
├── Filters: date_range, action_type
└── Cache Duration: 10 minutes
```

#### 4.1.2 Cashback Management APIs

```
POST /api/v1/cashback/calculate
├── Purpose: Calculate cashback for a transaction
├── Authentication: JWT Required
├── Authorization: System, Service-to-Service
├── Rate Limit: 1000 requests/minute
├── Validation: Transaction amount, user eligibility
└── Response Format: JSON

GET /api/v1/cashback/{userId}/summary
├── Purpose: Get user's cashback summary
├── Authentication: JWT Required
├── Authorization: User, Manager, Admin
├── Rate Limit: 100 requests/minute
└── Cache Duration: 5 minutes

GET /api/v1/cashback/{userId}/transactions
├── Purpose: Get cashback transaction history
├── Authentication: JWT Required
├── Authorization: User, Manager, Admin
├── Pagination: Offset-based
├── Filters: date_range, status, campaign_id
└── Cache Duration: 10 minutes
```

#### 4.1.3 Loyalty Program APIs

```
GET /api/v1/loyalty/programs
├── Purpose: Get available loyalty programs
├── Authentication: JWT Optional
├── Authorization: Public
├── Rate Limit: 200 requests/minute
├── Cache Duration: 1 hour
└── Response Format: JSON

GET /api/v1/loyalty/{userId}/status
├── Purpose: Get user's loyalty status
├── Authentication: JWT Required
├── Authorization: User, Manager, Admin
├── Rate Limit: 100 requests/minute
└── Cache Duration: 5 minutes

PUT /api/v1/loyalty/{userId}/upgrade
├── Purpose: Process loyalty tier upgrade
├── Authentication: JWT Required
├── Authorization: System, Service-to-Service
├── Rate Limit: 50 requests/minute
└── Validation: Spending thresholds, eligibility
```

## 5. Business Logic Flow Diagrams

### 5.1 Cashback Calculation Flow

```mermaid
flowchart TD
    START([Transaction Event Received]) --> VALIDATE{Validate Transaction}
    VALIDATE -->|Valid| GETUSER[Get User Details]
    VALIDATE -->|Invalid| REJECT[Reject & Log Error]
    
    GETUSER --> GETLOYALTY[Get User Loyalty Status]
    GETLOYALTY --> GETCAMPAIGNS[Get Active Campaigns]
    
    GETCAMPAIGNS --> APPLYRULES{Apply Cashback Rules}
    APPLYRULES --> BASECASHBACK[Calculate Base Cashback]
    BASECASHBACK --> LOYALTYBONUS[Apply Loyalty Bonus]
    LOYALTYBONUS --> CAMPAIGNBONUS[Apply Campaign Bonus]
    
    CAMPAIGNBONUS --> CHECKCAPS{Check Cashback Caps}
    CHECKCAPS -->|Within Limits| PROCESS[Process Cashback]
    CHECKCAPS -->|Exceeds Limits| APPLYCAP[Apply Cap Limits]
    
    APPLYCAP --> PROCESS
    PROCESS --> UPDATEWALLET[Update Wallet Balance]
    UPDATEWALLET --> UPDATEPOINTS[Update Reward Points]
    UPDATEPOINTS --> AUDIT[Log Audit Trail]
    AUDIT --> NOTIFY[Send Notification]
    NOTIFY --> END([Cashback Processed])
    
    REJECT --> END
```

### 5.2 Reward Redemption Flow

```mermaid
flowchart TD
    START([Redemption Request]) --> VALIDATEUSER{Validate User}
    VALIDATEUSER -->|Valid| CHECKBALANCE{Check Points Balance}
    VALIDATEUSER -->|Invalid| REJECT[Reject Request]
    
    CHECKBALANCE -->|Sufficient| VALIDATEREDEMPTION{Validate Redemption}
    CHECKBALANCE -->|Insufficient| INSUFFICIENT[Insufficient Points Error]
    
    VALIDATEREDEMPTION -->|Valid| CHECKREDEMPTIONRULES{Check Redemption Rules}
    VALIDATEREDEMPTION -->|Invalid| INVALIDREDEMPTION[Invalid Redemption Error]
    
    CHECKREDEMPTIONRULES -->|Passed| PROCESSREDEMPTION[Process Redemption]
    CHECKREDEMPTIONRULES -->|Failed| RULEFAILED[Rule Validation Failed]
    
    PROCESSREDEMPTION --> DEDUCTPOINTS[Deduct Points]
    DEDUCTPOINTS --> UPDATEBALANCE[Update Balance]
    UPDATEBALANCE --> GENERATEREWARD[Generate Reward]
    GENERATEREWARD --> AUDIT[Log Audit Trail]
    AUDIT --> NOTIFY[Send Notification]
    NOTIFY --> SUCCESS[Redemption Successful]
    
    REJECT --> END([Process Complete])
    INSUFFICIENT --> END
    INVALIDREDEMPTION --> END
    RULEFAILED --> END
    SUCCESS --> END
```

### 5.3 Loyalty Tier Upgrade Flow

```mermaid
flowchart TD
    START([Spending Event]) --> GETUSER[Get User Status]
    GETUSER --> CALCULATESPENDING[Calculate Total Spending]
    CALCULATESPENDING --> CHECKTHRESHOLD{Check Tier Thresholds}
    
    CHECKTHRESHOLD -->|Eligible for Upgrade| VALIDUPGRADE{Validate Upgrade}
    CHECKTHRESHOLD -->|Not Eligible| UPDATEPROGRESS[Update Progress Only]
    
    VALIDUPGRADE -->|Valid| PROCESSTIERUPGRADE[Process Tier Upgrade]
    VALIDUPGRADE -->|Invalid| LOGERROR[Log Error]
    
    PROCESSTIERUPGRADE --> UPDATESTATUS[Update Loyalty Status]
    UPDATESTATUS --> UNLOCKBENEFITS[Unlock New Benefits]
    UNLOCKBENEFITS --> CALCULATEBONUS[Calculate Upgrade Bonus]
    CALCULATEBONUS --> AWARDBONUS[Award Bonus Points]
    AWARDBONUS --> AUDIT[Log Audit Trail]
    AUDIT --> NOTIFY[Send Upgrade Notification]
    
    UPDATEPROGRESS --> AUDIT2[Log Progress Update]
    AUDIT2 --> END([Process Complete])
    
    NOTIFY --> END
    LOGERROR --> END
```

## 6. Integration Patterns

### 6.1 Event-Driven Integration

```mermaid
sequenceDiagram
    participant ES as Expense Service
    participant MQ as Message Queue
    participant CRS as Cashback & Rewards Service
    participant WS as Wallet Service
    participant NS as Notification Service

    ES->>MQ: Publish TransactionCompleted Event
    MQ->>CRS: Consume TransactionCompleted Event
    CRS->>CRS: Calculate Cashback & Points
    CRS->>WS: Update Wallet Balance
    WS->>CRS: Confirm Balance Update
    CRS->>CRS: Update Reward Points
    CRS->>MQ: Publish CashbackProcessed Event
    MQ->>NS: Consume CashbackProcessed Event
    NS->>NS: Send Cashback Notification
```

### 6.2 Synchronous API Integration

```mermaid
sequenceDiagram
    participant C as Client
    participant AG as API Gateway
    participant CRS as Cashback & Rewards Service
    participant US as User Service
    participant CACHE as Redis Cache

    C->>AG: GET /rewards/{userId}
    AG->>CRS: Forward Request with JWT
    CRS->>CRS: Validate JWT Token
    CRS->>CACHE: Check Cache
    
    alt Cache Hit
        CACHE->>CRS: Return Cached Data
    else Cache Miss
        CRS->>US: Get User Details
        US->>CRS: Return User Data
        CRS->>CRS: Calculate Reward Summary
        CRS->>CACHE: Store in Cache
    end
    
    CRS->>AG: Return Reward Summary
    AG->>C: Return Response
```

## 7. Caching Strategy

### 7.1 Cache Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        APP[Cashback & Rewards Service]
    end

    subgraph "Cache Layer"
        L1[L1 Cache - In-Memory]
        L2[L2 Cache - Redis]
    end

    subgraph "Database Layer"
        DB[(PostgreSQL)]
    end

    APP --> L1
    L1 --> L2
    L2 --> DB

    subgraph "Cache Strategies"
        STRATEGY1[User Loyalty Status - 5 min TTL]
        STRATEGY2[Reward Points Balance - 2 min TTL]
        STRATEGY3[Campaign Rules - 1 hour TTL]
        STRATEGY4[Cashback Calculations - 10 min TTL]
    end
```

### 7.2 Cache Invalidation Patterns

#### Write-Through Pattern
- **Use Case**: Critical data like reward points balance
- **Flow**: Write to cache and database simultaneously
- **Consistency**: Strong consistency guaranteed

#### Cache-Aside Pattern
- **Use Case**: User loyalty status, campaign rules
- **Flow**: Check cache first, load from DB on miss
- **Consistency**: Eventual consistency with TTL

#### Write-Behind Pattern
- **Use Case**: Audit logs, analytics data
- **Flow**: Write to cache immediately, DB asynchronously
- **Consistency**: Better performance, eventual consistency

## 8. Error Handling & Resilience

### 8.1 Error Classification

```mermaid
graph TB
    ERRORS[Error Types] --> BUSINESS[Business Errors]
    ERRORS --> TECHNICAL[Technical Errors]
    ERRORS --> INTEGRATION[Integration Errors]

    BUSINESS --> BE1[Insufficient Points]
    BUSINESS --> BE2[Invalid Redemption]
    BUSINESS --> BE3[Campaign Expired]
    BUSINESS --> BE4[Tier Ineligible]

    TECHNICAL --> TE1[Database Timeout]
    TECHNICAL --> TE2[Cache Unavailable]
    TECHNICAL --> TE3[Memory Limit]
    TECHNICAL --> TE4[Processing Error]

    INTEGRATION --> IE1[Service Unavailable]
    INTEGRATION --> IE2[Network Timeout]
    INTEGRATION --> IE3[Authentication Failed]
    INTEGRATION --> IE4[Rate Limit Exceeded]
```

### 8.2 Retry Mechanisms

#### Exponential Backoff Strategy
```
Retry Attempt 1: Wait 1 second
Retry Attempt 2: Wait 2 seconds
Retry Attempt 3: Wait 4 seconds
Retry Attempt 4: Wait 8 seconds
Maximum Retries: 5
```

#### Circuit Breaker Pattern
```
States:
├── CLOSED: Normal operation
├── OPEN: Service unavailable, fail fast
└── HALF_OPEN: Testing if service recovered

Thresholds:
├── Failure Rate: 50% over 1 minute
├── Timeout: 30 seconds
└── Recovery Time: 60 seconds
```

## 9. Security Considerations

### 9.1 Authentication & Authorization

```mermaid
graph TB
    REQUEST[Incoming Request] --> GATEWAY[API Gateway]
    GATEWAY --> VALIDATE[Validate JWT Token]
    VALIDATE --> EXTRACT[Extract User Claims]
    EXTRACT --> AUTHORIZE{Authorize Action}
    
    AUTHORIZE -->|Authorized| PROCESS[Process Request]
    AUTHORIZE -->|Unauthorized| REJECT[Reject - 403 Forbidden]
    
    PROCESS --> AUDIT[Log Access Audit]
    AUDIT --> RESPONSE[Return Response]
    
    REJECT --> AUDITFAIL[Log Failed Access]
    AUDITFAIL --> ERRORRESPONSE[Return Error]
```

### 9.2 Data Protection

#### Sensitive Data Handling
- **PII Encryption**: User personal data encrypted at rest
- **Token Security**: JWT tokens with short expiration
- **Database Security**: Connection encryption, parameterized queries
- **API Security**: Rate limiting, input validation, CORS protection

#### Audit Trail Requirements
- **User Actions**: All redemptions and point transfers logged
- **System Events**: Cashback calculations and tier upgrades
- **Access Logs**: API access patterns and failed attempts
- **Data Changes**: Complete change history with timestamps

## 10. Performance Optimization

### 10.1 Database Optimization

#### Indexing Strategy
```sql
-- User lookup optimization
CREATE INDEX idx_user_loyalty_status_user_id ON user_loyalty_status(user_id);
CREATE INDEX idx_reward_points_user_id_expiry ON reward_points(user_id, expiry_date);

-- Query performance optimization  
CREATE INDEX idx_cashback_transactions_user_status ON cashback_transactions(user_id, status);
CREATE INDEX idx_reward_history_user_created ON reward_history(user_id, created_at DESC);

-- Campaign lookup optimization
CREATE INDEX idx_campaigns_active_dates ON campaigns(is_active, start_date, end_date);
```

#### Query Optimization Patterns
- **Batch Processing**: Process multiple transactions together
- **Pagination**: Cursor-based pagination for large datasets  
- **Aggregation**: Pre-calculate frequently accessed summaries
- **Connection Pooling**: Optimize database connections

### 10.2 Application Performance

#### Memory Management
- **Object Pooling**: Reuse calculation objects
- **Garbage Collection**: Optimize GC for low latency
- **Memory Limits**: Set appropriate heap size limits
- **Memory Monitoring**: Track memory usage patterns

#### Async Processing
- **Non-blocking I/O**: Use async/await patterns
- **Background Jobs**: Process heavy calculations asynchronously
- **Queue Management**: Handle message processing efficiently
- **Load Balancing**: Distribute requests across instances

## 11. Monitoring & Observability

### 11.1 Metrics Collection

```mermaid
graph TB
    subgraph "Application Metrics"
        AM1[Request Rate]
        AM2[Response Time]
        AM3[Error Rate]
        AM4[Active Users]
    end

    subgraph "Business Metrics"
        BM1[Cashback Processed]
        BM2[Points Redeemed]
        BM3[Tier Upgrades]
        BM4[Campaign Performance]
    end

    subgraph "Infrastructure Metrics"
        IM1[CPU Usage]
        IM2[Memory Usage]
        IM3[Database Performance]
        IM4[Cache Hit Rate]
    end

    subgraph "Monitoring Stack"
        PROM[Prometheus]
        GRAF[Grafana]
        ALERT[AlertManager]
        ELK[ELK Stack]
    end

    AM1 --> PROM
    AM2 --> PROM
    BM1 --> PROM
    BM2 --> PROM
    IM1 --> PROM
    IM2 --> PROM

    PROM --> GRAF
    PROM --> ALERT
    
    AM3 --> ELK
    AM4 --> ELK
```

### 11.2 Health Check Implementation

#### Service Health Endpoints
```
GET /health
├── Purpose: Basic service availability
├── Response Time: < 100ms
├── Checks: Service startup, basic connectivity
└── Status Codes: 200 (healthy), 503 (unhealthy)

GET /health/detailed
├── Purpose: Comprehensive health check
├── Response Time: < 500ms
├── Checks: Database, cache, external services
└── Format: JSON with component status

GET /metrics
├── Purpose: Prometheus metrics endpoint
├── Format: Prometheus text format
├── Includes: Custom business metrics
└── Update Frequency: Real-time
```

## 12. Deployment Architecture

### 12.1 Container Configuration

```yaml
# Docker Container Specs
Resource Limits:
  CPU: 2 cores
  Memory: 4GB
  Disk: 20GB

Environment Variables:
  NODE_ENV: production
  PORT: 3009
  DB_HOST: postgresql-cluster
  REDIS_HOST: redis-cluster
  JWT_SECRET: ${JWT_SECRET}
  LOG_LEVEL: info

Health Check:
  Path: /health
  Interval: 30s
  Timeout: 10s
  Retries: 3
```

### 12.2 Scaling Strategy

#### Horizontal Scaling
- **Auto Scaling**: CPU > 70% or Memory > 80%
- **Min Replicas**: 2 instances
- **Max Replicas**: 10 instances
- **Scale Up**: Add 1 instance per trigger
- **Scale Down**: Remove 1 instance after 5 minutes

#### Load Distribution
- **Algorithm**: Round-robin with health checks
- **Session Persistence**: Not required (stateless)
- **Health Monitoring**: Continuous health checking
- **Failover**: Automatic unhealthy instance removal

This Low Level Design provides a comprehensive blueprint for implementing the Cashback & Rewards Service with detailed architecture, data models, API specifications, and operational considerations.