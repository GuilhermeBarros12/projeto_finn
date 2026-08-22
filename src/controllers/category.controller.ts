import type { Request, Response } from "express";
import { z } from "zod";
import { createCategorySchema } from "../schemas/category.schema";
import { CategoryService } from "../services/category.service";

export class CategoryController {
  constructor(private readonly categoryService = new CategoryService()) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const categories = await this.categoryService.list(request.userId!);
    response.status(200).json({ categories });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const category = await this.categoryService.create(request.userId!, createCategorySchema.parse(request.body));
    response.status(201).json({ category });
  };

  deactivate = async (request: Request, response: Response): Promise<void> => {
    const categoryId = z.uuid().parse(request.params.id);
    const result = await this.categoryService.deactivate(request.userId!, categoryId);
    response.status(200).json(result);
  };
}
