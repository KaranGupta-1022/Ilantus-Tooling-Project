# Phase 5 API manual test suite
# Run with: .\test_api_manual.ps1  (server must already be running via `flask run`)

$base = "http://127.0.0.1:5000"

Write-Host "--- Health & reference data ---"
irm "$base/api/health"
irm "$base/api/domains"
irm "$base/api/use-cases?domain=IGA"

Write-Host "--- Evaluate (text input) ---"
$body = @{
    vendor_name = "Test Vendor"
    input_type  = "text"
    input_value = "Our platform automates Joiner Mover Leaver workflows and performs access certification campaigns for enterprise applications."
    domain_code = "IGA"
} | ConvertTo-Json
$response = irm -Method Post -Uri "$base/api/evaluate" -Body $body -ContentType "application/json"
$response.vendor
$response.mapping | Where-Object { $_.covered -eq $true } | Format-Table use_case_code, name, confidence
$response.new_use_cases_found

$vendorId = $response.vendor.id

Write-Host "--- Vendors ---"
irm "$base/api/vendors?domain=IGA"
irm "$base/api/vendors/$vendorId"
irm "$base/api/compare?ids=$vendorId"

Write-Host "--- Pending use cases ---"
irm "$base/api/pending-use-cases?domain=IGA"

# To test PATCH/approve/reject, grab a pending id from the list above and run manually:
# irm -Method Patch -Uri "$base/api/pending-use-cases/<id>" -Body (@{suggested_name="New Name"} | ConvertTo-Json) -ContentType "application/json"
# irm -Method Post -Uri "$base/api/pending-use-cases/<id>/approve"
# irm -Method Post -Uri "$base/api/pending-use-cases/<id>/reject"
