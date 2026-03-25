type Props = {
  name: string;
};

const Label = ({ name }: Props) => {
  return (
    <div className="flex bg-[#ffffff] h-16 w-56 rounded-lg items-center justify-center mx-auto">
      <div className="text-[#0A5F59] font-bold flex-auto text-center text-xl">
        {name}
      </div>
    </div>
  );
};

export default Label;
