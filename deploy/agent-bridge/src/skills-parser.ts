import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { Skill } from './types.js';

export class SkillsParser {
  constructor(private skillsPath: string) {}

  async discoverSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      console.log(`Scanning for skills in: ${this.skillsPath}`);
      const discovered = await this.scanDirectory(this.skillsPath);
      skills.push(...discovered);
      console.log(`Discovered ${skills.length} skill(s)`);
    } catch (error: any) {
      console.warn(`Failed to scan skills directory: ${error.message}`);
    }

    return skills;
  }

  private async scanDirectory(dirPath: string): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subSkills = await this.scanDirectory(fullPath);
          skills.push(...subSkills);
        } else if (entry.name === 'SKILL.md') {
          const skill = await this.parseSkillFile(fullPath);
          if (skill) {
            skills.push(skill);
          }
        }
      }
    } catch (error: any) {
      // Silently skip directories we can't read
    }

    return skills;
  }

  private async parseSkillFile(filePath: string): Promise<Skill | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Extract YAML frontmatter between --- markers
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      
      if (!frontmatterMatch) {
        console.warn(`No frontmatter found in ${filePath}`);
        return null;
      }

      const frontmatter = parseYaml(frontmatterMatch[1]);

      return {
        name: frontmatter.name || 'Unknown',
        emoji: frontmatter.emoji || '🔧',
        description: frontmatter.description || 'No description',
        path: filePath,
        requires: frontmatter.requires || [],
      };
    } catch (error: any) {
      console.warn(`Failed to parse skill file ${filePath}: ${error.message}`);
      return null;
    }
  }
}
