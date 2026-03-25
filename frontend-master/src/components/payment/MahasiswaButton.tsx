import _React, { useEffect, useState } from "react";
import {
  IoPencilOutline as _IoPencilOutline,
  IoSearchOutline as _IoSearchOutline,
} from "react-icons/io5";
import { AiOutlineClose as _AiOutlineClose } from "react-icons/ai";
import { BsFillPeopleFill as _BsFillPeopleFill } from "react-icons/bs";
import _Link from "next/link";
import { format as _format, parseISO as _parseISO } from "date-fns";

function _formatDate(dateString: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return new Date(dateString).toLocaleDateString("id-ID", options);
}

const PaymenTable = ({ data: _data, filter: _filter }: any) => {
  const [_Category, _setCategory] = useState([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/api/internCategory`)
      .then((data) => {
        return data.json();
      })
      .then((objectData) => {
        _setCategory(objectData.data);
      });
  }, []);
  // console.log(Category)
  return null;
};

export default PaymenTable;
