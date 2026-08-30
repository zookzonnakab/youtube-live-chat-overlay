import type { NormalizedMessage } from "../domain/types";

const MAX_HISTORY = 20;

export class FeaturedService {
  private featured: NormalizedMessage | null = null;
  private history: NormalizedMessage[] = [];

  getFeatured(): NormalizedMessage | null {
    return this.featured;
  }

  getHistory(): NormalizedMessage[] {
    return [...this.history];
  }

  setFeatured(message: NormalizedMessage): NormalizedMessage {
    if (this.featured && this.featured.id !== message.id) {
      this.history.unshift(this.featured);
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(0, MAX_HISTORY);
      }
    }
    this.featured = message;
    return this.featured;
  }

  clearFeatured(): void {
    this.featured = null;
  }

  undoFeatured(): NormalizedMessage | null {
    if (this.history.length === 0) {
      this.featured = null;
      return null;
    }
    this.featured = this.history.shift()!;
    return this.featured;
  }
}
