type Props = {
  name: string;
  value: string;
};

const Button = ({ name, value }: Props) => {
  return (
    <>
      <div className="mb-12 flex">
        <div className="w-56">
          <label className="font-semibold">{name}</label>
        </div>
        <div className="w-1/2">
          <input
            type="text"
            id="jenis-magang"
            disabled
            placeholder={`${value}`}
            className="form-input px-2 py-0.5 shadow-md rounded border-none bg-gray-200 w-full"
          />
        </div>
      </div>
    </>
  );
};

export default Button;
