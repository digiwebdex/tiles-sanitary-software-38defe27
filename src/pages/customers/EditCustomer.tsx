import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import CustomerForm from "@/modules/customers/CustomerForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const EditCustomer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerService.getById(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (error || !customer) return (
    <div className="p-6">
      <p className="text-destructive">Customer not found.</p>
      <Button variant="outline" className="mt-2" onClick={() => navigate("/customers")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={() => navigate("/customers")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Edit Customer — {customer.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CustomerForm customer={customer} />
        </CardContent>
      </Card>
    </div>
  );
};

export default EditCustomer;
