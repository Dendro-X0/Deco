use std::collections::HashMap;
use std::path::Path;

use super::project_detection::{
    has_cmake_project_ancestor, has_cpp_native_project_ancestor, has_dotnet_project_ancestor,
    has_go_mod_ancestor, has_jvm_project_ancestor, has_python_project_ancestor,
};

/// Memoizes ancestor marker lookups during a single discovery walk (per scan root).
#[derive(Debug, Default)]
pub struct AncestorCache {
    go: HashMap<String, bool>,
    py: HashMap<String, bool>,
    jvm: HashMap<String, bool>,
    dotnet: HashMap<String, bool>,
    cmake: HashMap<String, bool>,
    cpp_native: HashMap<String, bool>,
}

fn cache_key(path: &Path) -> String {
    let s = path.to_string_lossy();
    #[cfg(windows)]
    {
        s.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        s.to_string()
    }
}

impl AncestorCache {
    pub fn has_go_mod_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.go.get(&key) {
            return hit;
        }
        let value = has_go_mod_ancestor(start_dir, max_ascend);
        self.go.insert(key, value);
        value
    }

    pub fn has_python_project_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.py.get(&key) {
            return hit;
        }
        let value = has_python_project_ancestor(start_dir, max_ascend);
        self.py.insert(key, value);
        value
    }

    pub fn has_jvm_project_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.jvm.get(&key) {
            return hit;
        }
        let value = has_jvm_project_ancestor(start_dir, max_ascend);
        self.jvm.insert(key, value);
        value
    }

    pub fn has_dotnet_project_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.dotnet.get(&key) {
            return hit;
        }
        let value = has_dotnet_project_ancestor(start_dir, max_ascend);
        self.dotnet.insert(key, value);
        value
    }

    pub fn has_cmake_project_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.cmake.get(&key) {
            return hit;
        }
        let value = has_cmake_project_ancestor(start_dir, max_ascend);
        self.cmake.insert(key, value);
        value
    }

    pub fn has_cpp_native_project_ancestor(&mut self, start_dir: &Path, max_ascend: u32) -> bool {
        let key = cache_key(start_dir);
        if let Some(&hit) = self.cpp_native.get(&key) {
            return hit;
        }
        let value = has_cpp_native_project_ancestor(start_dir, max_ascend);
        self.cpp_native.insert(key, value);
        value
    }
}
