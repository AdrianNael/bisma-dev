import Link from "next/link";
import React from "react";
import { useRouter } from "next/router";

// Segments to hide from breadcrumb (role-based paths)
const ROLE_SEGMENTS = ["user", "mahasiswa", "admin"];

type Props = {
  link: string;
  // Optional: Map of segment values to their display labels
  // e.g., { "15": "Nama Project", "edit": "Edit" }
  labels?: Record<string, string>;
  // Optional: Extra segments to add at the end of breadcrumb (not clickable)
  // e.g., ["Project Name"] to add as last breadcrumb item
  extraSegments?: string[];
};

const Breadcrumb = ({ link, labels = {}, extraSegments = [] }: Props) => {
  const router = useRouter();
  const pathname = link || router.pathname;

  const cleanPathname = pathname.split("?")[0].split("#")[0];
  const pathArray = cleanPathname.split("/").filter((item) => item !== "");

  // Filter out role segments
  const filteredPathArray = pathArray.filter(
    (segment) => !ROLE_SEGMENTS.includes(segment.toLowerCase()),
  );

  // Build href correctly by finding the original index in pathArray
  const getHrefForFilteredIndex = (filteredIndex: number): string => {
    // Find the original index in pathArray
    let originalIndex = -1;
    let filteredCount = 0;
    for (let i = 0; i < pathArray.length; i++) {
      if (!ROLE_SEGMENTS.includes(pathArray[i].toLowerCase())) {
        if (filteredCount === filteredIndex) {
          originalIndex = i;
          break;
        }
        filteredCount++;
      }
    }
    // Return full path up to and including originalIndex
    return `/${pathArray.slice(0, originalIndex + 1).join("/")}`;
  };

  return (
    <div className="mx-3 text-xs breadcrumbs text-gray-400">
      <ul>
        <li>
          <Link href={"/"}>Home</Link>
        </li>
        {filteredPathArray.map((v: string, i: number) => {
          const href = getHrefForFilteredIndex(i);
          // Use custom label if provided, otherwise decode the segment
          const label = labels[v] || decodeURIComponent(v);
          return (
            <li key={i}>
              <Link href={href}>{label}</Link>
            </li>
          );
        })}
        {/* Render extra segments at the end (not clickable) */}
        {extraSegments.map((segment, i) => (
          <li key={`extra-${i}`}>
            <span>{segment}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Breadcrumb;
