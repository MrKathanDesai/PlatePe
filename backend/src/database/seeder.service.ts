import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/entities/user.entity';
import { Category } from '../products/entities/category.entity';
import { getSuggestedCategoryStation } from '../products/utils/category-station';

const DEFAULT_USERS = [
  { name: 'Admin',   email: 'admin@platepe.com',   password: 'admin1234',   role: 'Admin'   },
  { name: 'Manager', email: 'manager@platepe.com', password: 'manager1234', role: 'Manager' },
  { name: 'Cashier', email: 'cashier@platepe.com', password: 'cashier1234', role: 'Cashier' },
  { name: 'Server',  email: 'server@platepe.com',  password: 'server1234',  role: 'Server'  },
  { name: 'Barista', email: 'barista@platepe.com', password: 'barista1234', role: 'Barista' },
  { name: 'Chef',    email: 'chef@platepe.com',    password: 'chef1234',    role: 'Chef'    },
] as const;

/** Default categories — match top-level category column in cafe_menu.csv */
const DEFAULT_CATEGORIES = [
  { name: 'Coffee',     station: 'BREWBAR', sortOrder: 1 },
  { name: 'Beverages',  station: 'BREWBAR', sortOrder: 2 },
  { name: 'Food',       station: 'KITCHEN', sortOrder: 3 },
] as const;

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedUsers();
    await this.seedCategories();
  }

  private async seedUsers() {
    const count = await this.userRepo.count();
    if (count > 0) return;

    this.logger.log('Seeding 6 default users…');
    for (const u of DEFAULT_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await this.userRepo.save(
        this.userRepo.create({ name: u.name, email: u.email, passwordHash, role: u.role }),
      );
    }
    this.logger.log('Default users created. Change passwords before going live!');
  }

  private async seedCategories() {
    const existing = await this.categoryRepo.find();
    const existingByName = new Map(existing.map((category) => [category.name.toLowerCase(), category]));
    let createdCount = 0;
    let normalizedCount = 0;
    const normalizedIds = new Set<string>();

    for (const defaults of DEFAULT_CATEGORIES) {
      const key = defaults.name.toLowerCase();
      const current = existingByName.get(key);

      if (!current) {
        await this.categoryRepo.save(
          this.categoryRepo.create({
            name: defaults.name,
            station: defaults.station,
            sortOrder: defaults.sortOrder,
          }),
        );
        createdCount += 1;
        continue;
      }

      const updates: Partial<Category> = {};
      if (current.station !== defaults.station) updates.station = defaults.station;
      if (current.sortOrder !== defaults.sortOrder) updates.sortOrder = defaults.sortOrder;

      if (Object.keys(updates).length > 0) {
        await this.categoryRepo.update(current.id, updates);
        normalizedCount += 1;
        normalizedIds.add(current.id);
      }
    }

    for (const category of existing) {
      if (normalizedIds.has(category.id)) continue;
      const suggestedStation = getSuggestedCategoryStation(category.name);
      if (!suggestedStation || suggestedStation === category.station) continue;

      await this.categoryRepo.update(category.id, { station: suggestedStation });
      normalizedCount += 1;
    }

    if (createdCount > 0) {
      this.logger.log(`Seeded ${createdCount} default categories.`);
    }
    if (normalizedCount > 0) {
      this.logger.log(`Normalized ${normalizedCount} category station assignments.`);
    }
  }
}
