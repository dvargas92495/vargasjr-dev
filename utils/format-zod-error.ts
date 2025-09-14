import { ZodError, ZodIssue } from "zod";

/** @public */
export const formatZodIssue = (issue: ZodIssue, indentation = 0): string => {
  const issuePath = issue.path.join(".") || "[root]";
  if (issue.code === "invalid_type") {
    return `Expected \`${issuePath}\` to be of type \`${issue.expected}\` but received type \`${issue.received}\``;
  } else if (issue.code === "invalid_union") {
    const subErrors = issue.unionErrors
      .map((e) => formatZodError(e, indentation + 1))
      .join("\n");
    return `Path \`${issuePath}\` had the following union errors:\n${subErrors}`;
  } else if (issue.code === "invalid_literal") {
    return `Invalid literal value at \`${issuePath}\`: expected \`${issue.expected}\` but received: \`${issue.received}\``;
  } else if (issue.code === "unrecognized_keys") {
    const formattedFields = issue.keys.map((k) => `\`${k}\``).join(", ");
    return `Unsupported keys at \`${issuePath}\`: ${formattedFields}`;
  } else {
    return `${issue.message} (${issue.code})`;
  }
};

const formatZodError = (e: ZodError, indentation = 0): string => {
  const formattedIssues = e.issues.map((i) => formatZodIssue(i, indentation));

  const formattedIssuePrefix = `${"".padStart(indentation * 2, " ")}- `;
  return formattedIssues.map((s) => `${formattedIssuePrefix}${s}`).join("\n");
};

export default formatZodError;
