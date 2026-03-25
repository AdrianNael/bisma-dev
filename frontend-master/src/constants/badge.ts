/**
 * Badge Styling Constants
 * Centralized status badge color configurations for consistent UI across the application
 */

export type StatusBadgeStyle = {
  bg: string;
  text: string;
  border?: string;
};

/**
 * Get badge styling based on status
 * @param status - The status string to get styling for
 * @returns StatusBadgeStyle object with background, text, and optional border colors
 */
export function getStatusBadgeStyle(status: string): StatusBadgeStyle {
  const normalizedStatus = status.toLowerCase().trim();

  // Complete/Completed - Light green bg with dark green text (final state)
  if (normalizedStatus.includes("complete")) {
    return {
      bg: "bg-green-200",
      text: "text-green-700",
    };
  }

  // Approved - Light green bg with dark green text (success)
  if (
    normalizedStatus.includes("approved") ||
    normalizedStatus === "project approved"
  ) {
    return {
      bg: "bg-green-200",
      text: "text-green-700",
    };
  }

  // Accepted (application accepted) - treat as success
  if (normalizedStatus === "accepted") {
    return {
      bg: "bg-green-200",
      text: "text-green-700",
    };
  }

  // Submitted - Light blue bg with dark blue text (info incoming)
  if (normalizedStatus === "submitted") {
    return {
      bg: "bg-blue-200",
      text: "text-blue-700",
    };
  }

  // Waiting - Light yellow bg with dark yellow text (pending action)
  if (normalizedStatus.includes("waiting")) {
    return {
      bg: "bg-yellow-200",
      text: "text-yellow-700",
    };
  }

  // On Revision - Light orange bg with dark orange text (warning/needs action)
  if (
    normalizedStatus.includes("revision") &&
    normalizedStatus.includes("on")
  ) {
    return {
      bg: "bg-orange-200",
      text: "text-orange-700",
    };
  }

  // Need Revision - Light orange bg with dark orange text (warning/needs action)
  if (
    normalizedStatus.includes("need") &&
    normalizedStatus.includes("revision")
  ) {
    return {
      bg: "bg-orange-200",
      text: "text-orange-700",
    };
  }

  // Revised - Light purple bg with dark purple text (updated data)
  if (normalizedStatus.includes("revised")) {
    return {
      bg: "bg-purple-200",
      text: "text-purple-700",
    };
  }

  // Rejected - Light red bg with dark red text (error/rejected)
  if (normalizedStatus.includes("reject")) {
    return {
      bg: "bg-red-200",
      text: "text-red-700",
    };
  }

  // Pending - generic pending status for applications
  if (normalizedStatus === "pending") {
    return {
      bg: "bg-yellow-200",
      text: "text-yellow-700",
    };
  }

  // Open - Light teal bg with dark teal text (available)
  if (normalizedStatus === "open") {
    return {
      bg: "bg-teal-200",
      text: "text-teal-700",
    };
  }

  // Draft - Light gray bg with dark gray text (inactive)
  if (normalizedStatus === "draft") {
    return {
      bg: "bg-gray-200",
      text: "text-gray-700",
    };
  }

  // Not Submitted - Light yellow bg with dark yellow text (default pending)
  if (normalizedStatus === "not submitted") {
    return {
      bg: "bg-yellow-200",
      text: "text-yellow-700",
    };
  }

  // Default fallback - Light gray bg with dark gray text
  return {
    bg: "bg-gray-200",
    text: "text-gray-700",
  };
}

/**
 * Get complete className string for status badge
 * @param status - The status string
 * @param additionalClasses - Additional Tailwind classes to append
 * @returns Complete className string
 */
export function getStatusBadgeClassName(
  status: string,
  additionalClasses: string = "",
): string {
  const style = getStatusBadgeStyle(status);
  const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold";

  return `${baseClasses} ${style.bg} ${style.text} ${additionalClasses}`.trim();
}
