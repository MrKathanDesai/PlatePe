import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateIngredientDto } from './create-ingredient.dto';

export class AdjustStockDto {
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  // Kept for compatibility with the current frontend inventory tab.
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Type(() => Number)
  @IsNumber()
  adjustment: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ImportIngredientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIngredientDto)
  rows: CreateIngredientDto[];
}

class ProductReferenceDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  productName?: string;
}

export class ImportRecipeLineRowDto extends ProductReferenceDto {
  @IsString()
  ingredientCode: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class ImportRecipeLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRecipeLineRowDto)
  rows: ImportRecipeLineRowDto[];

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

export class ImportRecipeModifierEffectRowDto extends ProductReferenceDto {
  @IsString()
  modifierName: string;

  @IsString()
  ingredientCode: string;

  @Type(() => Number)
  @IsNumber()
  quantityDelta: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ImportRecipeModifierEffectsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRecipeModifierEffectRowDto)
  rows: ImportRecipeModifierEffectRowDto[];

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
