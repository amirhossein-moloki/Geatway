import os
import json
import shutil
import subprocess
import sys
import tarfile

def main():
    repo_root = os.path.abspath(os.curdir)
    packages_dir = os.path.join(repo_root, "packages")
    test_dir = "/tmp/consumer_package_validation"
    tarball_tmp_dir = "/tmp/payment_platform_tarballs"

    print("=== Step 0: Building All Workspace Packages via pnpm build ===")
    res_workspace_build = subprocess.run(["pnpm", "build"], cwd=repo_root, capture_output=True, text=True)
    if res_workspace_build.returncode != 0:
        print(f"Workspace build failed: {res_workspace_build.stderr}")
        sys.exit(1)
    print("  Workspace build succeeded.")

    pkgs = [
        "payment-core",
        "payment-mellat",
        "payment-zibal",
        "payment-zarinpal",
        "payment-saman",
        "payment-service",
        "payment-persistence-postgres"
    ]

    for p in pkgs:
        pkg_path = os.path.join(packages_dir, p)
        res_bld = subprocess.run(["pnpm", "exec", "tsc"], cwd=pkg_path, capture_output=True, text=True)
        if res_bld.returncode != 0:
            print(f"Build failed for {p}: {res_bld.stderr}")
            sys.exit(1)
        print(f"  Built {p} (tsc)")

    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)

    if os.path.exists(tarball_tmp_dir):
        shutil.rmtree(tarball_tmp_dir)
    os.makedirs(tarball_tmp_dir)

    print("\n=== Step 1: Packing Workspace Packages & Auditing Tarballs ===")
    tarballs = {}
    for p in pkgs:
        pkg_path = os.path.join(packages_dir, p)
        res = subprocess.run(["pnpm", "pack", "--pack-destination", tarball_tmp_dir], cwd=pkg_path, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Failed to pack {p}: {res.stderr}")
            sys.exit(1)

        with open(os.path.join(pkg_path, "package.json")) as f:
            data = json.load(f)
        pkg_name = data["name"]

        if pkg_name.startswith("@"):
            clean_name = pkg_name[1:].replace("/", "-")
        else:
            clean_name = pkg_name
        expected_filename = f"{clean_name}-{data['version']}.tgz"
        found_tgz = os.path.join(tarball_tmp_dir, expected_filename)

        if not os.path.exists(found_tgz):
            print(f"Expected tarball not found at {found_tgz}")
            sys.exit(1)

        # Audit Tarball
        with tarfile.open(found_tgz, "r:gz") as tar:
            members = tar.getnames()
            for member in members:
                if member.endswith(".env") or member.endswith(".log"):
                    print(f"Forbidden file in tarball {found_tgz}: {member}")
                    sys.exit(1)
                if member.startswith("package/src/"):
                    print(f"Uncompiled source in tarball {found_tgz}: {member}")
                    sys.exit(1)

            # Check workspace dependency resolution in extracted package.json
            extracted_pj = tar.extractfile("package/package.json")
            if not extracted_pj:
                print(f"Missing package.json in tarball {found_tgz}")
                sys.exit(1)
            pj_json = json.load(extracted_pj)
            deps = pj_json.get("dependencies", {})
            for d, v in deps.items():
                if "workspace:" in v:
                    print(f"Unresolved workspace dependency in {found_tgz}: {d} -> {v}")
                    sys.exit(1)
                if v.startswith(".") or ("/" in v and not v.startswith("@")):
                    print(f"Relative dependency path in {found_tgz}: {d} -> {v}")
                    sys.exit(1)

        tarballs[pkg_name] = found_tgz
        print(f"  Packed & Verified {pkg_name} -> {found_tgz}")

    print("\n=== Step 2: Creating External Consumer Project ===")
    consumer_pj = {
        "name": "external-consumer-app",
        "version": "1.0.0",
        "private": True,
        "type": "module",
        "dependencies": {
            "@amirhossein-moloki/payment-core": tarballs["@amirhossein-moloki/payment-core"],
            "@amirhossein-moloki/payment-mellat": tarballs["@amirhossein-moloki/payment-mellat"],
            "@amirhossein-moloki/payment-zibal": tarballs["@amirhossein-moloki/payment-zibal"],
            "@amirhossein-moloki/payment-service": tarballs["@amirhossein-moloki/payment-service"]
        },
        "devDependencies": {
            "typescript": "^5.4.5",
            "@types/node": "^20.0.0"
        }
    }

    with open(os.path.join(test_dir, "package.json"), "w") as f:
        json.dump(consumer_pj, f, indent=2)

    consumer_tsconfig = {
        "compilerOptions": {
            "target": "ES2022",
            "module": "NodeNext",
            "moduleResolution": "NodeNext",
            "strict": True
        }
    }
    with open(os.path.join(test_dir, "tsconfig.json"), "w") as f:
        json.dump(consumer_tsconfig, f, indent=2)

    consumer_code = """
import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { MellatGateway } from '@amirhossein-moloki/payment-mellat';
import { ZibalGateway } from '@amirhossein-moloki/payment-zibal';
import { PaymentApplicationService, InMemoryPaymentRepository, InMemoryTransactionRepository } from '@amirhossein-moloki/payment-service';

const registry = new GatewayRegistry();
const mellat = new MellatGateway({ terminalId: '123', userName: 'u', userPassword: 'p', callbackUrl: 'https://example.com/mellat' });
const zibal = new ZibalGateway({ merchant: 'zibal', callbackUrl: 'https://example.com/zibal' });

registry.register(mellat);
registry.register(zibal);

const paymentRepository = new InMemoryPaymentRepository();
const transactionRepository = new InMemoryTransactionRepository();

const service = new PaymentApplicationService({ registry, paymentRepository, transactionRepository });

console.log("Registered Gateways:", registry.listGateways().map(g => g.id));
console.log("CONSUMER_PACKAGE_VERIFICATION_SUCCESS");
"""
    with open(os.path.join(test_dir, "index.ts"), "w") as f:
        f.write(consumer_code)

    print("\n=== Step 3: Installing Tarball Artifacts in Consumer App ===")
    res_inst = subprocess.run(["npm", "install"], cwd=test_dir, capture_output=True, text=True)
    if res_inst.returncode != 0:
        print("npm install failed:", res_inst.stderr)
        sys.exit(1)
    print("  npm install completed successfully.")

    print("\n=== Step 4: Compiling Consumer App with TypeScript ===")
    res_tsc = subprocess.run(["npx", "tsc"], cwd=test_dir, capture_output=True, text=True)
    if res_tsc.returncode != 0:
        print("tsc compilation failed:", res_tsc.stderr, res_tsc.stdout)
        sys.exit(1)
    print("  tsc compilation succeeded with zero errors.")

    print("\n=== Step 5: Executing Consumer App ===")
    res_node = subprocess.run(["node", "index.js"], cwd=test_dir, capture_output=True, text=True)
    if res_node.returncode != 0:
        print("node execution failed:", res_node.stderr)
        sys.exit(1)
    print("  Output:", res_node.stdout.strip())

    print("\n=== Step 6: Cleaning Temporary Tarballs ===")
    if os.path.exists(tarball_tmp_dir):
        shutil.rmtree(tarball_tmp_dir)
    print("  Cleaned temporary tarball directory.")

    if "CONSUMER_PACKAGE_VERIFICATION_SUCCESS" in res_node.stdout:
        print("\n=== Consumer Package Validation PASSED ===")
    else:
        print("\n=== Consumer Package Validation FAILED ===")
        sys.exit(1)

if __name__ == "__main__":
    main()
