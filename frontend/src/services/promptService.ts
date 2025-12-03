/**
 * 提示词服务
 * 通过 Wails 后端获取提示词列表
 */

import { FetchPrompts } from '../../wailsjs/go/core/App';

export interface PromptItem {
  title: string;
  preview?: string;
  prompt: string;
  author?: string;
  link?: string;
  mode?: 'generate' | 'edit';
  category?: string;
  sub_category?: string;
}

let cachedPrompts: PromptItem[] | null = null;
let isLoading = false;
let loadPromise: Promise<PromptItem[]> | null = null;

/**
 * 获取提示词列表
 * @param forceRefresh 是否强制刷新缓存
 * @returns 提示词列表
 */
export async function fetchPrompts(forceRefresh: boolean = false): Promise<PromptItem[]> {
  // 如果已有缓存且不强制刷新，直接返回
  if (cachedPrompts && !forceRefresh) {
    return cachedPrompts;
  }

  // 如果正在加载，返回同一个 Promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  // 开始加载
  isLoading = true;
  loadPromise = (async () => {
    try {
      const promptsJSON = await FetchPrompts(forceRefresh);
      if (!promptsJSON) {
        return [];
      }
      const data = JSON.parse(promptsJSON);
      cachedPrompts = data as PromptItem[];
      return cachedPrompts;
    } catch (error) {
      console.error('获取提示词列表失败:', error);
      // 返回空数组而不是抛出错误，避免 UI 崩溃
      return [];
    } finally {
      isLoading = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * 根据分类筛选提示词
 * @param prompts 提示词列表
 * @param category 分类名称（可选）
 * @param subCategory 子分类名称（可选）
 * @returns 筛选后的提示词列表
 */
export function filterPromptsByCategory(
  prompts: PromptItem[],
  category?: string,
  subCategory?: string
): PromptItem[] {
  if (!category) return prompts;
  
  let filtered = prompts.filter(p => p.category === category);
  
  if (subCategory) {
    filtered = filtered.filter(p => p.sub_category === subCategory);
  }
  
  return filtered;
}

/**
 * 搜索提示词
 * @param prompts 提示词列表
 * @param keyword 搜索关键词
 * @returns 匹配的提示词列表
 */
export function searchPrompts(prompts: PromptItem[], keyword: string): PromptItem[] {
  if (!keyword.trim()) return prompts;
  
  const lowerKeyword = keyword.toLowerCase();
  return prompts.filter(p => 
    p.title.toLowerCase().includes(lowerKeyword) ||
    p.prompt.toLowerCase().includes(lowerKeyword) ||
    p.category?.toLowerCase().includes(lowerKeyword) ||
    p.sub_category?.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 获取所有分类
 * @param prompts 提示词列表
 * @returns 分类列表（包含子分类）
 */
export function getCategories(prompts: PromptItem[]): { category: string; subCategories: string[] }[] {
  const categoryMap = new Map<string, Set<string>>();
  
  prompts.forEach(p => {
    if (p.category) {
      if (!categoryMap.has(p.category)) {
        categoryMap.set(p.category, new Set());
      }
      if (p.sub_category) {
        categoryMap.get(p.category)!.add(p.sub_category);
      }
    }
  });
  
  return Array.from(categoryMap.entries()).map(([category, subCategories]) => ({
    category,
    subCategories: Array.from(subCategories).sort(),
  })).sort((a, b) => a.category.localeCompare(b.category));
}

