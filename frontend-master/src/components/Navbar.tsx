type Props = {
  title: string;
};

const Navbar = (props: Props) => {
  const { title } = props;

  return (
    <div className="flex items-center justify-center h-10 bg-stone-50 rounded-md drop-shadow-md m-2">
      <h1 className="text-lg font-semibold text-center">{title}</h1>{" "}
    </div>
  );
};

export default Navbar;
