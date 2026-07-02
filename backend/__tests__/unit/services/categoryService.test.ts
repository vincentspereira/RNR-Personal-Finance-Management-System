jest.mock('../../../src/db', () => require('./../../unit/__mocks__/db'));

import * as categoryService from '../../../src/services/categoryService';
import { queryMock } from './../../unit/__mocks__/db';

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', type: 'expense', color: '#22c55e', icon: 'FaShoppingBasket', parent_id: null, parent_name: null },
  { id: 'cat-2', name: 'Dining', type: 'expense', color: '#f97316', icon: 'FaUtensils', parent_id: null, parent_name: null },
  { id: 'cat-3', name: 'Salary', type: 'income', color: '#22c55e', icon: 'FaBriefcase', parent_id: null, parent_name: null },
  { id: 'cat-4', name: 'Fast Food', type: 'expense', color: '#ef4444', icon: 'FaHamburger', parent_id: 'cat-2', parent_name: 'Dining' },
];

const userId = 'test-user-id';

describe('categoryService', () => {
  beforeEach(() => queryMock.mockReset());

  describe('listCategories', () => {
    it('returns flat list as tree with children', async () => {
      queryMock.mockResolvedValue({ rows: mockCategories });
      const result = await categoryService.listCategories(userId);

      // Should be a tree - top level has no parent_id or parent not in map
      expect(result.length).toBe(3); // Groceries, Dining (with child), Salary

      // Find Dining which should have Fast Food as child
      const dining = result.find((c: any) => c.id === 'cat-2');
      expect(dining).toBeDefined();
      expect(dining.children).toHaveLength(1);
      expect(dining.children[0].name).toBe('Fast Food');
    });

    it('handles empty categories', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const result = await categoryService.listCategories(userId);
      expect(result).toEqual([]);
    });

    it('handles categories without any children', async () => {
      const noChildren = mockCategories.filter(c => c.id !== 'cat-4');
      queryMock.mockResolvedValue({ rows: noChildren });
      const result = await categoryService.listCategories(userId);
      result.forEach((c: any) => expect(c.children).toEqual([]));
    });
  });

  describe('createCategory', () => {
    it('creates a category with all fields', async () => {
      const newCat = { id: 'cat-new', name: 'Hobbies', type: 'expense', color: '#a855f7', icon: 'FaPaint' };
      queryMock.mockResolvedValue({ rows: [newCat] });

      const result = await categoryService.createCategory(userId, {
        name: 'Hobbies', type: 'expense', color: '#a855f7', icon: 'FaPaint',
      });

      expect(result.name).toBe('Hobbies');
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        [userId, 'Hobbies', 'expense', '#a855f7', 'FaPaint', null]
      );
    });

    it('uses default color when not provided', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'x' }] });
      await categoryService.createCategory(userId, { name: 'Test', type: 'expense' });
      const params = queryMock.mock.calls[0][1];
      expect(params[3]).toBe('#3b82f6');
    });

    it('passes parent_id for subcategories after verifying parent ownership', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }) // validateCategoryExists(parent)
        .mockResolvedValueOnce({ rows: [{ id: 'x' }] });
      await categoryService.createCategory(userId, { name: 'Sub', type: 'expense', parent_id: 'cat-1' });
      const insertCall = queryMock.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO categories/);
      expect(insertCall[1][5]).toBe('cat-1');
    });

    it('rejects subcategories whose parent is not owned by the user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await expect(categoryService.createCategory(userId, {
        name: 'Sub', type: 'expense', parent_id: 'foreign',
      })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateCategory', () => {
    it('updates provided fields', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'cat-1', name: 'Updated' }] });
      const result = await categoryService.updateCategory('cat-1', userId, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('returns null when no fields provided', async () => {
      const result = await categoryService.updateCategory('cat-1', userId, {});
      expect(result).toBeNull();
    });
  });

  describe('deleteCategory', () => {
    it('deletes a category', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'cat-1' }] });

      const result = await categoryService.deleteCategory('cat-1', userId);
      expect(result).toEqual({ id: 'cat-1' });
    });

    it('reassigns transactions before deleting', async () => {
      queryMock.mockResolvedValue({ rows: [{ id: 'cat-1' }] });

      await categoryService.deleteCategory('cat-1', userId, 'cat-2');
      // First call should be the reassign UPDATE
      expect(queryMock.mock.calls[0][0]).toContain('UPDATE transactions SET category_id');
    });

    it('returns null when category not found', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      const result = await categoryService.deleteCategory('missing', userId);
      expect(result).toBeNull();
    });
  });
});
