mod components;
#[path = "views/contributions.rs"]
mod contributions;
#[path = "views/dialogs.rs"]
mod dialogs;
#[path = "views/discovery.rs"]
mod discovery;
#[path = "views/environment.rs"]
mod environment;
#[path = "views/home.rs"]
mod home;
mod navigation;
mod render;
#[path = "views/replay.rs"]
mod replay;
#[path = "views/repository_detail.rs"]
mod repository_detail;
mod runtime;
#[path = "views/settings.rs"]
mod settings;
mod state;
#[path = "views/watchlist.rs"]
mod watchlist;

use crate::service::{AssetDownload, Change, Job, Outcome, Services, Snapshot};
use anyhow::{Result, bail};
use git_nexus_core::models::*;
use gpui::{prelude::*, *};
use gpui_component::{
    ActiveTheme, Disableable, Icon, Sizable,
    button::{Button, ButtonVariants},
    input::{Input, InputEvent, InputState},
    resizable::{h_resizable, resizable_panel, v_resizable},
    text::{TextView, TextViewStyle},
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
    rc::Rc,
    sync::{Arc, Mutex},
};

use components::*;
use state::Notice;
pub use state::{Nexus, Screen};
