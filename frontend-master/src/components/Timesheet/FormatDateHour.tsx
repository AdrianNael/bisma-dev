type Props = {
  date: string;
};

const FormatDateHour = () => {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const _FormatDate = ({ date }: Props) => {
    return new Date(date).toLocaleDateString("id-ID", options);
  };
  // const FormatHour = ({ date }: Props) => {
};
export default FormatDateHour;
