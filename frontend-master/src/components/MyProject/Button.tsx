type Props = {
  name: string;
};

const Button = ({ name }: Props) => {
  return (
    <button className="bg-[#ffffff] px-2.5 py-1 rounded float-right text-black">
      {name}
    </button>
  );
};

export default Button;
