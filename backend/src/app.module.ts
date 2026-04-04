import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SeederService } from './database/seeder.service';

import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProductsModule } from './products/products.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { KDSModule } from './kds/kds.module';
import { InventoryModule } from './inventory/inventory.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ReportingModule } from './reporting/reporting.module';
import { AuditModule } from './audit/audit.module';

// Entities
import { User } from './auth/entities/user.entity';
import { Terminal } from './sessions/entities/terminal.entity';
import { Session } from './sessions/entities/session.entity';
import { Category } from './products/entities/category.entity';
import { Modifier } from './products/entities/modifier.entity';
import { Product } from './products/entities/product.entity';
import { Table } from './tables/entities/table.entity';
import { Order } from './orders/entities/order.entity';
import { OrderLineItem } from './orders/entities/order-line-item.entity';
import { Payment } from './payments/entities/payment.entity';
import { KDSTicket } from './kds/entities/kds-ticket.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { Discount } from './discounts/entities/discount.entity';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD') || undefined,
        database: config.get('DB_NAME', 'platepe_pos'),
        entities: [
          User,
          Terminal,
          Session,
          Category,
          Modifier,
          Product,
          Table,
          Order,
          OrderLineItem,
          Payment,
          KDSTicket,
          AuditLog,
          Discount,
        ],
        synchronize: true, // Use migrations in production
        logging: config.get('NODE_ENV') !== 'production',
      }),
    }),

    AuthModule,
    SessionsModule,
    ProductsModule,
    TablesModule,
    OrdersModule,
    PaymentsModule,
    KDSModule,
    InventoryModule,
    DiscountsModule,
    ReportingModule,
    AuditModule,
    TypeOrmModule.forFeature([User, Category]),
  ],
  providers: [AppService, SeederService],
})
export class AppModule {}
