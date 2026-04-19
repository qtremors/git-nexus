fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    println!("cargo:rerun-if-changed=resources/app.rc");
    println!("cargo:rerun-if-changed=../../../assets/git-nexus.ico");
    let version = std::env::var("CARGO_PKG_VERSION").expect("Missing package version");
    let icon = std::path::Path::new("../../../assets/git-nexus.ico")
        .canonicalize()
        .expect("Missing application icon")
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches("//?/")
        .to_owned();
    let resource = std::fs::read_to_string("resources/app.rc")
        .expect("Cannot read Windows resources")
        .replace("@VERSION@", &version)
        .replace(
            "@NUMERIC_VERSION@",
            &format!("{},0", version.replace('.', ",")),
        )
        .replace("@ICON@", &icon);
    let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").expect("Missing OUT_DIR"))
        .join("app.rc");
    std::fs::write(&output, resource).expect("Cannot write Windows resources");
    embed_resource::compile(output, embed_resource::NONE)
        .manifest_optional()
        .expect("Cannot compile Windows application resources");
}
