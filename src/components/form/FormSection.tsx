/**
 * @file FormSection.tsx
 * @description A group of related fields inside a form or modal. Title and description are both optional.
 *
 * WHEN TO USE WHAT
 *   - Several steps of one task (receiving): give each a `step` number and a title.
 *   - A long modal with distinct parts ("Item details"): a title, a description only if it helps.
 *   - A short form where one block is enough: no title at all, just spacing between blocks.
 *
 *   <FormSection step={1} title="Source" description="Where the items came from.">...fields...</FormSection>
 *   <FormSection title="Item details">...fields...</FormSection>
 *   <FormSection>...fields...</FormSection>
 *
 * Put `<FormLegend />` once at the top of a form that has required fields.
 */
import React from 'react';

interface Props {
  /** step number shown before the title, for forms that are a sequence of steps */
  step?: number;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<Props> = ({ step, title, description, children }) => (
  <section className="mb-4">
    {(title || description) && (
      <div className="mb-2 pb-1 border-bottom">
        {title && <h6 className="fw-bold small text-uppercase text-muted mb-0">{step !== undefined ? `${step}. ` : ''}{title}</h6>}
        {description && <div className="small text-muted">{description}</div>}
      </div>
    )}
    <div className="row g-3">{children}</div>
  </section>
);

/** "* required" note for the top of a form. */
export const FormLegend: React.FC = () => (
  <div className="small text-muted mb-3"><span className="text-danger">*</span> required</div>
);
