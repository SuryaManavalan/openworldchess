#!/usr/bin/env bash
# Run after the GoDaddy nameservers point at Route 53 and the ACM certificate
# says ISSUED: attaches openworldchess.com + www to the CloudFront distribution.
set -euo pipefail
DIST=${DIST:-E3LWTLW0LK3EW}
CERT=${CERT:-arn:aws:acm:us-east-1:968267201240:certificate/660bd4b2-ffa8-4613-b485-bd5abd723a3f}
status=$(aws acm describe-certificate --certificate-arn "$CERT" --region us-east-1 --query Certificate.Status --output text)
echo "certificate: $status"
[ "$status" = ISSUED ] || { echo "Not issued yet: waiting on DNS validation (nameservers)."; exit 1; }
tmp=$(mktemp -d)
aws cloudfront get-distribution-config --id "$DIST" > "$tmp/d.json"
etag=$(python3 -c "import json;print(json.load(open('$tmp/d.json'))['ETag'])")
python3 - "$tmp/d.json" "$CERT" > "$tmp/cfg.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))['DistributionConfig']
d['Aliases'] = {'Quantity': 2, 'Items': ['openworldchess.com', 'www.openworldchess.com']}
d['ViewerCertificate'] = {'ACMCertificateArn': sys.argv[2], 'SSLSupportMethod': 'sni-only', 'MinimumProtocolVersion': 'TLSv1.2_2021', 'Certificate': sys.argv[2], 'CertificateSource': 'acm'}
print(json.dumps(d))
PY
aws cloudfront update-distribution --id "$DIST" --if-match "$etag" --distribution-config "file://$tmp/cfg.json" --query 'Distribution.Status' --output text
echo "Attached. https://openworldchess.com will work once CloudFront finishes deploying (a few minutes)."
