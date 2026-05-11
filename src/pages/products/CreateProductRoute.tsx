import { useDealerId } from "@/hooks/useDealerId";
import CreateProductPage from "@/pages/products/CreateProduct";

const CreateProductRoute = () => {
  const dealerId = useDealerId();

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <CreateProductPage dealerId={dealerId} />
    </div>
  );
};

export default CreateProductRoute;
