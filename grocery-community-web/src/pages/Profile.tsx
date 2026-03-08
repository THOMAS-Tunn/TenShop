import { useEffect, useState } from "react";
import type { SessionUser } from "../lib/auth";
import { Card } from "../components/Card";
import { supabase } from "../lib/supabase";

type Address = {
  id: string;
  label: string | null;
  recipient_name: string | null;
  phone: string | null;
  street_1: string;
  street_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  delivery_notes: string | null;
  is_default: boolean;
};

export function Profile({ user }: { user: SessionUser }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [label, setLabel] = useState("Home");
  const [recipientName, setRecipientName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    setFullName(data?.full_name ?? "");
    setPhone(data?.phone ?? "");
  }

  async function loadAddresses() {
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setAddresses((data ?? []) as Address[]);
  }

  useEffect(() => {
    void loadProfile();
    void loadAddresses();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Profile saved");
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();

    if (isDefault) {
      await supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    const { error } = await supabase.from("user_addresses").insert({
      user_id: user.id,
      label,
      recipient_name: recipientName,
      phone: addressPhone,
      street_1: street1,
      street_2: street2 || null,
      city,
      state: stateValue || null,
      postal_code: postalCode || null,
      country,
      delivery_notes: deliveryNotes || null,
      is_default: isDefault,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setLabel("Home");
    setRecipientName("");
    setAddressPhone("");
    setStreet1("");
    setStreet2("");
    setCity("");
    setStateValue("");
    setPostalCode("");
    setCountry("US");
    setDeliveryNotes("");
    setIsDefault(false);

    await loadAddresses();
  }

  async function makeDefault(addressId: string) {
    await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
    const { error } = await supabase.from("user_addresses").update({ is_default: true }).eq("id", addressId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAddresses();
  }

  async function deleteAddress(addressId: string) {
    const { count, error: checkError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("address_id", addressId);

    if (checkError) {
      alert(checkError.message);
      return;
    }

    if ((count ?? 0) > 0) {
      alert(
        "You cannot delete this address because it is already used by one or more orders. Please keep it for order history, or add a new address and set that one as default."
      );
      return;
    }

    const ok = window.confirm("Delete this saved address?");
    if (!ok) return;

    const { error } = await supabase.from("user_addresses").delete().eq("id", addressId);
    if (error) {
      alert(error.message);
      return;
    }
    await loadAddresses();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="text-sm font-semibold">Account</div>

          <form onSubmit={saveProfile} className="mt-4 grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                value={user.email ?? ""}
                disabled
                className="w-full rounded-2xl border bg-slate-50 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
            </div>

            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
              Save profile
            </button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Add address</div>

          <form onSubmit={addAddress} className="mt-4 grid gap-3">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (Home, Work)" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={addressPhone} onChange={(e) => setAddressPhone(e.target.value)} placeholder="Phone" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="Street address" required className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apartment / unit" className="rounded-2xl border px-3 py-2 text-sm" />

            <div className="grid gap-3 md:grid-cols-3">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" required className="rounded-2xl border px-3 py-2 text-sm" />
              <input value={stateValue} onChange={(e) => setStateValue(e.target.value)} placeholder="State" className="rounded-2xl border px-3 py-2 text-sm" />
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="ZIP code" className="rounded-2xl border px-3 py-2 text-sm" />
            </div>

            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded-2xl border px-3 py-2 text-sm" />
            <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Delivery notes" className="rounded-2xl border px-3 py-2 text-sm" />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Make this my default address
            </label>

            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
              Add address
            </button>
          </form>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="text-sm font-semibold">Saved addresses</div>

        <div className="mt-4 space-y-3">
          {addresses.length === 0 ? (
            <div className="text-sm text-slate-600">No addresses yet.</div>
          ) : (
            addresses.map((a) => (
              <div key={a.id} className="rounded-2xl border px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {a.label ?? "Address"} {a.is_default ? "• Default" : ""}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {a.recipient_name ?? "No recipient"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!a.is_default ? (
                      <button
                        onClick={() => makeDefault(a.id)}
                        className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Make default
                      </button>
                    ) : null}
                    <button
                      onClick={() => deleteAddress(a.id)}
                      className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  <div>{a.street_1}</div>
                  {a.street_2 ? <div>{a.street_2}</div> : null}
                  <div>
                    {a.city}
                    {a.state ? `, ${a.state}` : ""} {a.postal_code ?? ""}
                  </div>
                  <div>{a.country}</div>
                  {a.delivery_notes ? (
                    <div className="mt-2 text-slate-500">Notes: {a.delivery_notes}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </main>
  );
}
