import CustomerForm from "@/modules/customers/CustomerForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CreateCustomer = () => (
  <div className="p-4 lg:p-6 max-w-5xl mx-auto">
    <Card>
      <CardHeader>
        <CardTitle>Add Customer</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerForm />
      </CardContent>
    </Card>
  </div>
);

export default CreateCustomer;
