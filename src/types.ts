export type SourceValue<T = unknown> = { value: T; src: string }

export type AddressStatus = 'exact' | 'street_only' | 'none' | 'disputed' | 'manual'
export type LocationStatus =
  | 'exact_confirmed'
  | 'parcel_located'
  | 'needs_verification'
  | 'not_confirmed'
  | 'not_located'
  | 'manual'

export interface SourceLink { label: string; url: string; src: string }

export interface Property {
  id: string
  record_no: number | null
  record_type: 'property' | 'unidentified' | 'manual'
  account_number: string | null
  parcel_number: string | null
  account_number_as_written?: string | null
  address_line: string | null
  city: string | null
  state: string | null
  zip: string | null
  site_address_as_written: string | null
  address_status: AddressStatus
  location_status: LocationStatus
  lat: number | null
  lng: number | null
  geometry: GeoJSON.Geometry | null
  location_source: string | null
  location_checked_at: string | null
  property_type: string | null
  property_type_group: string | null
  acreage: number | null
  land_sqft: number | null
  building_sqft: number | null
  bedrooms: number | null
  bathrooms: number | null
  assessed_value: number | null
  assessed_value_label: string | null
  estimated_value: number | null
  estimated_value_label: string | null
  last_sale_date: string | null
  last_sale_price: number | null
  status: string
  contacted: boolean
  follow_up_date: string | null
  verification_status: string
  reviewed: boolean
  reviewed_at: string | null
  reviewed_by_name: string | null
  research_notes: string | null
  source_pages: string | null
  source_ref: string | null
  source_notes: SourceValue<string>[]
  source_links: SourceLink[]
  source_values: Record<string, SourceValue> | null
  archived: boolean
  created_at: string
  updated_at: string
  created_by_name: string | null
  updated_by_name: string | null
}

export interface Owner {
  id: string
  property_id: string
  owner_name: string | null
  ownership_entity: string | null
  registered_agent: string | null
  registered_agent_address: string | null
  trustee: string | null
  mailing_address: string | null
  phones_listed_for: string | null
  phones_listed_for_age: number | null
  owner_age_in_source: number | null
  summary_owner_name: string | null
  source_ref: string | null
  source_values: Record<string, unknown> | null
  archived: boolean
  updated_at?: string
  updated_by_name?: string | null
}

export interface OwnerContact {
  id: string
  property_id: string
  owner_id: string
  phone: string | null
  phone_type: string | null
  connection_status: string | null
  annotation: string | null
  highlight: string | null
  source_ref: string | null
  source_values: Record<string, unknown> | null
  archived: boolean
  updated_at?: string
}

export interface PersonPhone { phone: string; type: string | null }

export interface Person {
  id: string
  property_id: string
  name: string
  age_in_source: number | null
  relationship: string | null
  address: string | null
  phones: PersonPhone[]
  sort_order: number | null
  source_ref: string | null
  source_values: Record<string, unknown> | null
  archived: boolean
  updated_at?: string
}

export interface SummaryRecord {
  id: string
  property_id: string
  row_no: number
  address_as_written: string
  owner_as_written: string
  value_as_written: string
  acreage_as_written: string
  last_sold_as_written: string
  link_as_written: string
  link_basis: string
  source_ref: string
}

export interface Note {
  id: string
  property_id: string
  body: string
  category: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string | null
  updated_by_name: string | null
  deleted_at: string | null
  is_import: boolean
}

export interface PropertyImage {
  id: string
  property_id: string
  storage_path: string
  file_name: string | null
  caption: string | null
  image_notes: string | null
  source: string | null
  is_source: boolean
  sha256: string | null
  image_reading: Record<string, string> | null
  verification: string | null
  uploaded_by_name: string | null
  uploaded_at: string
  archived: boolean
}

export interface IssueValue { value: string; src: string }

export interface DataIssue {
  id: string
  property_id: string | null
  related_property_ids: string[]
  severity: 'critical' | 'conflict' | 'info'
  category: string | null
  field: string | null
  title: string
  detail: string | null
  issue_values: IssueValue[]
  status: 'open' | 'accepted' | 'resolved'
  resolution_note: string | null
  resolved_by_name: string | null
  resolved_at: string | null
  created_at: string
  created_by_name: string | null
}

export interface ParcelLookup {
  property_id: string
  parcel_id: string | null
  source: string | null
  fetched_at: string | null
  status: 'found' | 'not_found' | 'multiple' | 'error' | null
  attributes: Record<string, unknown> | null
  geometry: GeoJSON.Geometry | null
  centroid_lat: number | null
  centroid_lng: number | null
  geocode: GeocodeCheck | null
  geocode_checked_at: string | null
  error: string | null
}

export interface GeocodeCheck {
  query: string
  status: string
  formatted_address?: string
  location_type?: string
  lat?: number
  lng?: number
  distance_to_parcel_m?: number
  inside_parcel?: boolean
  result: 'agrees' | 'disagrees' | 'no_result' | 'error'
}

export interface AuditEntry {
  id: number
  table_name: string
  row_id: string | null
  property_id: string | null
  action: string
  field: string | null
  old_value: unknown
  new_value: unknown
  note: string | null
  changed_by_name: string | null
  changed_at: string
}

export interface Member { email: string; display_name: string; added_at?: string; added_by?: string | null }

export interface Settings {
  statuses: string[]
  verification_statuses: string[]
  note_categories: string[]
  county_parcel_service: string
  maps_api_key?: string
  maps_map_id?: string
}

export interface AllData {
  properties: Property[]
  owners: Owner[]
  owner_contacts: OwnerContact[]
  relatives: Person[]
  associates: Person[]
  summary_records: SummaryRecord[]
  notes: Note[]
  property_images: PropertyImage[]
  data_issues: DataIssue[]
  parcel_lookups: ParcelLookup[]
  settings: Settings
  members: Member[]
}

export type EditableTable = 'properties' | 'owners' | 'owner_contacts' | 'relatives' | 'associates'
