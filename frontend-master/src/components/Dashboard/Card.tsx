import React from "react";

type Props = {
  title: string;
  data: any;
  bgHex?: string;
  textColor?: string;
};

const Card = ({ title, data, bgHex, textColor }: Props) => {
  const style: React.CSSProperties = {};
  if (bgHex) style.backgroundColor = bgHex;
  if (textColor) style.color = textColor;

  const baseClasses =
    "flex flex-col rounded-lg w-full h-44 my-1 p-5 shadow-lg shadow-gray-700 justify-between";
  const defaultBgClass = !bgHex ? "bg-teal-800" : "";
  const defaultTextClass = !textColor ? "text-white" : "";

  return (
    <div
      className={`${baseClasses} ${defaultBgClass} ${defaultTextClass}`}
      style={style}
    >
      <div className="flex flex-row justify-between">
        <div className="flex justify-start text-sm md:text-base lg:text-base">
          {title}
        </div>
      </div>

      <div className="text-3xl md:text-2xl lg:text-2xl mb-4">{data}</div>
    </div>
  );
};

export default Card;
