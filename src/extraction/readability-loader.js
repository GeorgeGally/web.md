import { Readability, isProbablyReaderable } from '@mozilla/readability';

export function extractContent(document_) {
  if (!isProbablyReaderable(document_)) {
    return null;
  }

  const clone = document_.cloneNode(true);
  const reader = new Readability(clone);
  const article = reader.parse();

  if (!article || !article.content) {
    return null;
  }

  return article;
}