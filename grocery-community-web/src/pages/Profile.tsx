import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
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
  const { copy } = useAppSettings();
  const common = copy.common;
  const profile = copy.profile;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [label, setLabel] = useState(profile.homeLabel);
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

    alert(profile.profileSaved);
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();

    if (isDefault) {
      await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
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

    setLabel(profile.homeLabel);
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
      alert(profile.cannotDeleteUsedAddress);
      return;
    }

    const ok = window.confirm(profile.deleteAddressConfirm);
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
      <h1 className="text-2xl font-semibold">{profile.title}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="text-sm font-semibold">{profile.account}</div>

          <form onSubmit={saveProfile} className="mt-4 grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{common.email}</label>
              <input
                value={user.email ?? ""}
                disabled
                className="w-full rounded-2xl border bg-slate-50 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{common.fullName}</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{common.phone}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
            </div>

            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
              {profile.saveProfile}
            </button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">{profile.addAddress}</div>

          <form onSubmit={addAddress} className="mt-4 grid gap-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={profile.labelPlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={profile.recipientNamePlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <input
              value={addressPhone}
              onChange={(e) => setAddressPhone(e.target.value)}
              placeholder={profile.phonePlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <input
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              placeholder={profile.streetPlaceholder}
              required
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <input
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              placeholder={profile.apartmentPlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />

            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={profile.cityPlaceholder}
                required
                className="rounded-2xl border px-3 py-2 text-sm"
              />
              <input
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                placeholder={profile.statePlaceholder}
                className="rounded-2xl border px-3 py-2 text-sm"
              />
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder={profile.zipPlaceholder}
                className="rounded-2xl border px-3 py-2 text-sm"
              />
            </div>

            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={profile.countryPlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder={profile.deliveryNotesPlaceholder}
              className="rounded-2xl border px-3 py-2 text-sm"
            />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              {profile.makeDefault}
            </label>

            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
              {profile.addAddressButton}
            </button>
          </form>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="text-sm font-semibold">{profile.savedAddresses}</div>

        <div className="mt-4 space-y-3">
          {addresses.length === 0 ? (
            <div className="text-sm text-slate-600">{profile.noAddressesYet}</div>
          ) : (
            addresses.map((address) => (
              <div key={address.id} className="rounded-2xl border px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {address.label ?? profile.addressFallback}
                      {address.is_default ? ` | ${profile.defaultBadge}` : ""}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {address.recipient_name ?? common.noRecipient}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!address.is_default ? (
                      <button
                        onClick={() => void makeDefault(address.id)}
                        className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        {profile.makeDefaultButton}
                      </button>
                    ) : null}
                    <button
                      onClick={() => void deleteAddress(address.id)}
                      className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {common.delete}
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  <div>{address.street_1}</div>
                  {address.street_2 ? <div>{address.street_2}</div> : null}
                  <div>
                    {address.city}
                    {address.state ? `, ${address.state}` : ""} {address.postal_code ?? ""}
                  </div>
                  <div>{address.country}</div>
                  {address.delivery_notes ? (
                    <div className="mt-2 text-slate-500">
                      {common.notesValue(address.delivery_notes)}
                    </div>
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
