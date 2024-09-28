import React from "react";
import markdownit from "markdown-it";
import DOMPurify from 'dompurify';

type Props = {
  text: string;
};

const md = markdownit();

const Markdown = ({ text }: Props) => {
  // Check if text is a valid string
  if (typeof text !== 'string') {
    console.error("Invalid input: text should be a string");
    return null; // Or you could return a fallback UI
  }

  const htmlcontent = md.render(text);
  const sanitized = DOMPurify.sanitize(htmlcontent);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }}></div>;
};

export default Markdown;
